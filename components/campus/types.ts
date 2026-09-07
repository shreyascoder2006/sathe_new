import type { BuildingLive } from "@/backend/queries";

export type { BuildingLive };

export function buildingTone(b: Pick<BuildingLive, "status" | "healthScore">) {
  if (b.status === "critical" || b.healthScore < 65) return "#f87171";
  if (b.status === "attention" || b.healthScore < 82) return "#f59e0b";
  return "#34d399";
}

export function overlayValue(
  b: BuildingLive,
  overlay: "none" | "energy" | "occupancy" | "accessibility",
): { label: string; intensity: number; color: string } | null {
  if (overlay === "energy") {
    const dev = b.energyDeviationPct;
    return {
      label: `${dev > 0 ? "+" : ""}${dev}% vs baseline`,
      intensity: Math.max(0, Math.min(1, dev / 50)),
      color: dev >= 25 ? "#f87171" : dev >= 12 ? "#f59e0b" : "#22d3ee",
    };
  }
  if (overlay === "occupancy") {
    const pct = b.occupancyPct;
    return {
      label: `${pct}% of capacity`,
      intensity: Math.max(0, Math.min(1, pct / 100)),
      color: pct >= 90 ? "#f87171" : pct >= 70 ? "#f59e0b" : "#3b82f6",
    };
  }
  if (overlay === "accessibility") {
    const bad = b.liftStatus === "out_of_service";
    return {
      label: bad ? "lift out of service" : b.liftStatus === "none" ? "no lift" : "step-free OK",
      intensity: bad ? 1 : 0,
      color: bad ? "#f87171" : "#34d399",
    };
  }
  return null;
}
