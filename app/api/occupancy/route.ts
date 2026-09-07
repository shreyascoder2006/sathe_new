import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { getCampusNow } from "@/backend/sim/engine";
import { detectOccupancyAnomalies } from "@/backend/anomaly/detect";
import { seasonalForecast } from "@/backend/ml/forecast";
import { CATEGORY_COLORS, type BuildingCategory } from "@/lib/geo/campus";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const now = await getCampusNow();
    const since = new Date(now.getTime() - 2 * 24 * 3.6e6);
    const forecastSince = new Date(now.getTime() - 21 * 24 * 3.6e6);
    const buildings = await prisma.building.findMany({ orderBy: { name: "asc" } });
    const anomalies = await detectOccupancyAnomalies();

    const perBuilding = await Promise.all(
      buildings.map(async (b) => {
        const [readings, forecastHistory] = await Promise.all([
          prisma.occupancyReading.findMany({
            where: { buildingId: b.id, at: { gte: since } },
            orderBy: { at: "asc" },
          }),
          prisma.occupancyReading.findMany({
            where: { buildingId: b.id, at: { gte: forecastSince } },
            orderBy: { at: "asc" },
            select: { at: true, count: true, capacity: true },
          }),
        ]);
        const latest = readings.at(-1);
        const capacity = latest?.capacity ?? forecastHistory.at(-1)?.capacity ?? 1;
        const pct =
          latest && latest.capacity > 0 ? Math.round((latest.count / latest.capacity) * 100) : 0;

        // ML predicted congestion: seasonal forecast for the next 6 hours
        const fc = seasonalForecast(
          forecastHistory.map((r) => ({ at: r.at, value: r.count })),
          now,
          6,
        );
        const predicted = fc
          .map((p) => ({
            label: p.at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
            people: Math.round(p.value),
            load: Math.round((p.value / capacity) * 100),
          }))
          .filter((p) => p.load >= 78);

        return {
          id: b.id,
          name: b.name,
          shortName: b.shortName,
          color: CATEGORY_COLORS[b.category as BuildingCategory] ?? "#94A3B8",
          count: latest?.count ?? 0,
          capacity: latest?.capacity ?? 0,
          occupancyPct: pct,
          baseline: latest?.baseline ?? 0,
          density: pct >= 90 ? "congested" : pct >= 70 ? "busy" : pct >= 35 ? "moderate" : "light",
          predictedCongestion: predicted,
          alternateRoute:
            pct >= 85
              ? "Route incoming flow via the secondary corridor / east entrance; stagger the next hall release."
              : null,
          series: readings.map((r) => ({ at: r.at, count: r.count, baseline: r.baseline })),
        };
      }),
    );

    const campusPeople = perBuilding.reduce((s, b) => s + b.count, 0);
    return {
      campusNow: now.toISOString(),
      campusPeople,
      congestionZones: perBuilding.filter((b) => b.occupancyPct >= 85).map((b) => b.id),
      anomalies,
      buildings: perBuilding,
    };
  });
}
