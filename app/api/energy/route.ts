import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { getCampusNow } from "@/backend/sim/engine";
import { detectEnergyAnomalies } from "@/backend/anomaly/detect";
import { forecastPeak } from "@/backend/ml/forecast";
import { CATEGORY_COLORS, type BuildingCategory } from "@/lib/geo/campus";
import { RUPEE_PER_KWH } from "@/lib/constants";
import { fmtClock } from "@/lib/format";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const now = await getCampusNow();
    const since = new Date(now.getTime() - 7 * 24 * 3.6e6);
    const buildings = await prisma.building.findMany({ orderBy: { name: "asc" } });
    const anomalies = await detectEnergyAnomalies();

    const perBuilding = await Promise.all(
      buildings.map(async (b) => {
        const readings = await prisma.energyReading.findMany({
          where: { buildingId: b.id, at: { gte: since } },
          orderBy: { at: "asc" },
        });
        const latest = readings.at(-1);
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const today = readings.filter((r) => r.at >= dayStart);
        const todayKwh = today.reduce((s, r) => s + r.kwh, 0);
        const todayBaseline = today.reduce((s, r) => s + r.baseline, 0);
        const wasteKwh = Math.max(0, todayKwh - todayBaseline);
        const dev =
          latest && latest.baseline > 0
            ? Math.round(((latest.kwh - latest.baseline) / latest.baseline) * 100)
            : 0;
        const healthScore = Math.max(30, Math.min(100, 100 - Math.max(0, dev) * 1.4));
        const peak = forecastPeak(
          readings.map((r) => ({ at: r.at, value: r.kwh })),
          now,
          24,
        );
        return {
          id: b.id,
          name: b.name,
          shortName: b.shortName,
          color: CATEGORY_COLORS[b.category as BuildingCategory] ?? "#94A3B8",
          currentKwh: latest?.kwh ?? 0,
          baselineKwh: latest?.baseline ?? 0,
          deviationPct: dev,
          todayKwh: Math.round(todayKwh),
          todayBaseline: Math.round(todayBaseline),
          wasteKwh: Math.round(wasteKwh),
          wasteRupees: Math.round(wasteKwh * RUPEE_PER_KWH),
          energyHealth: Math.round(healthScore),
          forecastPeakKwh: peak ? Math.round(peak.value) : null,
          forecastPeakAt: peak ? fmtClock(peak.at) : null,
          status: b.energyStatus,
          recommendation:
            dev >= 25
              ? "Verify HVAC/lab equipment schedule — draw is well above baseline outside teaching hours."
              : dev >= 12
                ? "Minor over-draw — check lighting circuits in unoccupied wings."
                : "Within expected band — no action needed.",
          series: readings.map((r) => ({
            at: r.at,
            kwh: r.kwh,
            baseline: r.baseline,
          })),
        };
      }),
    );

    const campusToday = perBuilding.reduce((s, b) => s + b.todayKwh, 0);
    const campusWaste = perBuilding.reduce((s, b) => s + b.wasteKwh, 0);

    return {
      campusNow: now.toISOString(),
      campusTodayKwh: campusToday,
      campusWasteKwh: campusWaste,
      campusWasteRupees: Math.round(campusWaste * RUPEE_PER_KWH),
      energyHealth: Math.round(
        perBuilding.reduce((s, b) => s + b.energyHealth, 0) / Math.max(perBuilding.length, 1),
      ),
      anomalies,
      buildings: perBuilding,
    };
  });
}
