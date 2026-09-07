import { z } from "zod";
import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { requireOperator } from "@/backend/session";

export const dynamic = "force-dynamic";

const Schema = z.object({ status: z.enum(["assigned", "in_progress", "done"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    await requireOperator();
    const { status } = Schema.parse(await req.json());
    const task = await prisma.maintenanceTask.update({
      where: { id },
      data: { status, ...(status === "done" ? { completedAt: new Date() } : {}) },
    });
    await prisma.activityLog.create({
      data: { kind: "maintenance", message: `${task.code} → ${status.replace("_", " ")}` },
    });
    if (status === "done" && task.equipmentId) {
      await prisma.equipment.update({
        where: { id: task.equipmentId },
        data: { status: "healthy", healthScore: 90, failureRisk: 0.08, lastServicedAt: new Date() },
      });
    }
    return task;
  });
}
