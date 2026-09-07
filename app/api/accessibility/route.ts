import { z } from "zod";
import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { runAutomationForAnomaly } from "@/backend/automation/engine";
import { requireOperator } from "@/backend/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const buildings = await prisma.building.findMany({
      orderBy: { name: "asc" },
      include: { accessRoutes: true },
    });
    const obstacles = await prisma.incident.findMany({
      where: { type: "accessibility" },
      orderBy: { createdAt: "desc" },
      include: { building: true },
    });
    return {
      buildings: buildings.map((b) => ({
        id: b.id,
        name: b.name,
        shortName: b.shortName,
        liftStatus: b.liftStatus,
        status: b.status,
        routes: b.accessRoutes,
        stepFreeAvailable: b.accessRoutes.some((r) => r.stepFree && r.available),
      })),
      obstacles,
    };
  });
}

const Schema = z.object({
  buildingId: z.string(),
  action: z.enum(["report_lift_outage", "report_obstacle", "restore"]),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    await requireOperator();
    const { buildingId, action, note } = Schema.parse(await req.json());
    const building = await prisma.building.findUnique({ where: { id: buildingId } });
    if (!building) throw new Error("Building not found");

    if (action === "restore") {
      await prisma.building.update({
        where: { id: buildingId },
        data: { liftStatus: "operational", status: "nominal" },
      });
      await prisma.accessRoute.updateMany({
        where: { buildingId },
        data: { available: true, note: "Restored — step-free access available." },
      });
      await prisma.incident.updateMany({
        where: { buildingId, type: "accessibility", status: { not: "resolved" } },
        data: { status: "resolved", resolvedAt: new Date() },
      });
      await prisma.activityLog.create({
        data: { kind: "user", message: `Accessibility restored for ${building.name}.` },
      });
      return { ok: true };
    }

    const result = await runAutomationForAnomaly({
      type: "accessibility",
      severity: "high",
      buildingId,
      metric: action === "report_lift_outage" ? "lift_status" : "obstacle",
      current: 0,
      baseline: 1,
      deviationPct: -100,
      window: "now",
      unit: "state",
      headline:
        action === "report_lift_outage"
          ? `Lift out of service in ${building.name} — upper floors not step-free`
          : `Accessibility obstacle reported in ${building.name}${note ? `: ${note}` : ""}`,
    });
    return result;
  });
}
