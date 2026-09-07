import { z } from "zod";
import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { shortCode } from "@/lib/format";
import { detectEquipmentAnomalies } from "@/backend/anomaly/detect";
import { requireOperator } from "@/backend/session";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const buildingId = new URL(req.url).searchParams.get("buildingId");
  return handle(async () => {
    const equipment = await prisma.equipment.findMany({
      where: buildingId ? { buildingId } : undefined,
      orderBy: { failureRisk: "desc" },
      include: {
        building: true,
        tasks: { orderBy: { createdAt: "desc" } },
        sensorReadings: { orderBy: { at: "desc" }, take: 60 },
      },
    });
    const anomalies = await detectEquipmentAnomalies();
    return {
      anomalies,
      equipment: equipment.map((e) => ({
        ...e,
        sensorReadings: [...e.sensorReadings].reverse(),
        predictedDays: e.predictedServiceAt
          ? Math.round((e.predictedServiceAt.getTime() - Date.now()) / 8.64e7)
          : null,
      })),
    };
  });
}

const TaskSchema = z.object({
  equipmentId: z.string(),
  title: z.string().min(4).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    await requireOperator();
    const body = TaskSchema.parse(await req.json());
    const eq = await prisma.equipment.findUnique({ where: { id: body.equipmentId } });
    if (!eq) throw new Error("Equipment not found");
    const assignee = await prisma.user.findFirst({ where: { team: "Lab Staff" } });
    const task = await prisma.maintenanceTask.create({
      data: {
        code: shortCode("TSK"),
        title: body.title || `Predictive maintenance — ${eq.name}`,
        team: "Lab Staff",
        priority: eq.failureRisk > 0.5 ? "high" : "medium",
        status: "assigned",
        equipmentId: eq.id,
        assigneeId: assignee?.id ?? null,
      },
    });
    await prisma.equipment.update({
      where: { id: eq.id },
      data: { status: eq.status === "healthy" ? "monitor" : eq.status },
    });
    await prisma.activityLog.create({
      data: { kind: "maintenance", message: `${task.code} raised for ${eq.name} (Lab Staff)` },
    });
    return task;
  });
}
