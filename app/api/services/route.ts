import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { getCampusNow } from "@/backend/sim/engine";
import { queueFor } from "@/backend/sim/engine";
import { detectQueueAnomalies } from "@/backend/anomaly/detect";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const now = await getCampusNow();
    const services = await prisma.service.findMany({
      where: { isQueued: true },
      include: {
        building: true,
        queueSamples: { orderBy: { at: "desc" }, take: 40 },
      },
      orderBy: { name: "asc" },
    });
    const anomalies = await detectQueueAnomalies();

    const rows = services.map((s) => {
      const latest = s.queueSamples[0];
      const wait = latest?.waitMinutes ?? s.queueLength * s.avgServiceMinutes;

      // predicted peak in the next 5 hours
      let peak = { label: "—", wait: 0 };
      for (let h = 0; h <= 5; h++) {
        const at = new Date(now.getTime() + h * 3.6e6);
        const q = queueFor(s.avgServiceMinutes, at);
        if (q.waitMinutes > peak.wait)
          peak = {
            label: at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
            wait: Math.round(q.waitMinutes),
          };
      }

      // recommended off-peak window (lowest wait in next 6h)
      let best = { label: "—", wait: Infinity };
      for (let h = 0; h <= 6; h++) {
        const at = new Date(now.getTime() + h * 3.6e6);
        if (at.getHours() < 9 || at.getHours() > 17) continue;
        const q = queueFor(s.avgServiceMinutes, at);
        if (q.waitMinutes < best.wait)
          best = {
            label: at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
            wait: Math.round(q.waitMinutes),
          };
      }

      return {
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        buildingName: s.building.name,
        buildingId: s.buildingId,
        queueLength: latest?.queueLength ?? s.queueLength,
        waitMinutes: Math.round(wait),
        status: s.status,
        predictedPeak: peak,
        recommendedWindow: best.wait === Infinity ? null : best,
        series: [...s.queueSamples].reverse().map((q) => ({ at: q.at, wait: q.waitMinutes, queue: q.queueLength })),
      };
    });

    return { campusNow: now.toISOString(), anomalies, services: rows };
  });
}
