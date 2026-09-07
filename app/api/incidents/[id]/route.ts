import { z } from "zod";
import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { requireOperator } from "@/backend/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        building: true,
        assignee: true,
        tasks: { include: { assignee: true } },
        notifications: true,
        execution: { include: { rule: true } },
      },
    });
    if (!incident) throw new Error("Incident not found");
    return incident;
  });
}

const PatchSchema = z.object({
  status: z.enum(["open", "acknowledged", "in_progress", "resolved"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  assigneeId: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    await requireOperator();
    const body = PatchSchema.parse(await req.json());
    const prev = await prisma.incident.findUnique({ where: { id } });
    if (!prev) throw new Error("Incident not found");

    const incident = await prisma.incident.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.severity ? { severity: body.severity } : {}),
        ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
        ...(body.status === "resolved" ? { resolvedAt: new Date() } : {}),
      },
      include: { building: true, assignee: true, tasks: true },
    });

    if (body.status && body.status !== prev.status) {
      await prisma.activityLog.create({
        data: {
          kind: "incident",
          message: `${incident.code} status changed ${prev.status} → ${body.status}`,
        },
      });
      if (body.status === "resolved") {
        await prisma.maintenanceTask.updateMany({
          where: { incidentId: id, status: { not: "done" } },
          data: { status: "done", completedAt: new Date() },
        });
        if (incident.buildingId) {
          const openForBuilding = await prisma.incident.count({
            where: { buildingId: incident.buildingId, status: { not: "resolved" } },
          });
          if (openForBuilding === 0) {
            await prisma.building.update({
              where: { id: incident.buildingId },
              data: { status: "nominal", energyStatus: "nominal", healthScore: 90 },
            });
          }
        }
      }
    }
    return incident;
  });
}
