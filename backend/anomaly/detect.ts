import { prisma } from "@/backend/db";
import type { Severity } from "@/lib/constants";
import { anomalyScore } from "@/backend/ml/forecast";

export interface Anomaly {
  type: "energy" | "occupancy" | "equipment" | "queue" | "accessibility" | "security";
  severity: Severity;
  buildingId?: string;
  equipmentId?: string;
  serviceId?: string;
  metric: string;
  current: number;
  baseline: number;
  deviationPct: number;
  /** robust modified z-score from the hour-of-week distribution (ML detector) */
  zScore?: number;
  window: string;
  headline: string;
  unit: string;
}

function severityFromDeviation(pct: number, bands: [number, number, number]): Severity {
  const a = Math.abs(pct);
  if (a >= bands[2]) return "critical";
  if (a >= bands[1]) return "high";
  if (a >= bands[0]) return "medium";
  return "low";
}

const devPct = (current: number, baseline: number) =>
  baseline <= 0 ? 0 : Math.round(((current - baseline) / baseline) * 1000) / 10;

/** Energy: compare the latest hourly reading against its rolling baseline. */
export async function detectEnergyAnomalies(buildingId?: string): Promise<Anomaly[]> {
  const buildings = await prisma.building.findMany({
    where: buildingId ? { id: buildingId } : undefined,
    select: { id: true, name: true },
  });
  const out: Anomaly[] = [];
  for (const b of buildings) {
    const history = await prisma.energyReading.findMany({
      where: { buildingId: b.id },
      orderBy: { at: "desc" },
      take: 21 * 24,
    });
    const latest = history[0];
    if (!latest) continue;
    const pct = devPct(latest.kwh, latest.baseline);
    // ML detector: robust z-score against the same hour-of-week
    const z = anomalyScore(
      latest.kwh,
      history.map((r) => ({ at: r.at, value: r.kwh })).reverse(),
    );
    if (!z.anomalous && pct < 18) continue;
    out.push({
      type: "energy",
      severity: z.score >= 6 || pct >= 55 ? "critical" : z.score >= 4.5 || pct >= 30 ? "high" : "medium",
      buildingId: b.id,
      metric: "grid_draw",
      current: latest.kwh,
      baseline: Math.max(latest.baseline, z.expected),
      deviationPct: pct,
      zScore: z.score,
      window: "current hour vs 3-week hour-of-week profile",
      unit: "kWh",
      headline: `${b.name} is drawing ${pct}% more power than its expected baseline`,
    });
  }
  return out;
}

/** Occupancy: latest count vs expected baseline for this hour. */
export async function detectOccupancyAnomalies(buildingId?: string): Promise<Anomaly[]> {
  const buildings = await prisma.building.findMany({
    where: buildingId ? { id: buildingId } : undefined,
    select: { id: true, name: true },
  });
  const out: Anomaly[] = [];
  for (const b of buildings) {
    const latest = await prisma.occupancyReading.findFirst({
      where: { buildingId: b.id },
      orderBy: { at: "desc" },
    });
    if (!latest || latest.baseline < 5) continue;
    const pct = devPct(latest.count, latest.baseline);
    const load = latest.capacity > 0 ? latest.count / latest.capacity : 0;
    if (pct < 25 && load < 0.85) continue;
    out.push({
      type: "occupancy",
      severity: load >= 0.95 ? "high" : severityFromDeviation(pct, [25, 45, 75]),
      buildingId: b.id,
      metric: "occupancy",
      current: latest.count,
      baseline: latest.baseline,
      deviationPct: pct,
      window: "live headcount vs expected",
      unit: "people",
      headline: `${b.name} occupancy is ${Math.round(load * 100)}% of capacity — ${pct}% above expected`,
    });
  }
  return out;
}

/** Equipment: latest sensor value vs baseline + trend. */
export async function detectEquipmentAnomalies(equipmentId?: string): Promise<Anomaly[]> {
  const equipment = await prisma.equipment.findMany({
    where: equipmentId ? { id: equipmentId } : undefined,
  });
  const out: Anomaly[] = [];
  for (const eq of equipment) {
    const readings = await prisma.sensorReading.findMany({
      where: { equipmentId: eq.id },
      orderBy: { at: "desc" },
      take: 8,
    });
    if (readings.length === 0) continue;
    const latest = readings[0];
    const pct = devPct(latest.value, latest.baseline);
    const anomalousRecent = readings.filter((r) => r.anomalous).length;
    if (pct < 22 && anomalousRecent < 2) continue;
    out.push({
      type: "equipment",
      severity: severityFromDeviation(pct, [22, 40, 65]),
      equipmentId: eq.id,
      buildingId: eq.buildingId,
      metric: latest.metric,
      current: latest.value,
      baseline: latest.baseline,
      deviationPct: pct,
      window: `last ${readings.length} samples`,
      unit: latest.metric.includes("vibration")
        ? "mm/s"
        : latest.metric.includes("temperature")
          ? "°C"
          : "A",
      headline: `${eq.name} ${latest.metric.replace(/_/g, " ")} is ${pct}% above its healthy baseline`,
    });
  }
  return out;
}

/** Queue: current queue length / predicted wait beyond a comfort threshold. */
export async function detectQueueAnomalies(serviceId?: string): Promise<Anomaly[]> {
  const services = await prisma.service.findMany({
    where: { isQueued: true, ...(serviceId ? { id: serviceId } : {}) },
  });
  const out: Anomaly[] = [];
  for (const svc of services) {
    const sample = await prisma.queueSample.findFirst({
      where: { serviceId: svc.id },
      orderBy: { at: "desc" },
    });
    if (!sample) continue;
    if (sample.waitMinutes < 18) continue;
    out.push({
      type: "queue",
      severity: sample.waitMinutes >= 35 ? "high" : sample.waitMinutes >= 25 ? "medium" : "low",
      serviceId: svc.id,
      buildingId: svc.buildingId,
      metric: "wait_time",
      current: sample.waitMinutes,
      baseline: 12,
      deviationPct: devPct(sample.waitMinutes, 12),
      window: "current queue",
      unit: "min",
      headline: `${svc.name}: ${Math.round(sample.waitMinutes)} min estimated wait (${sample.queueLength} in queue)`,
    });
  }
  return out;
}

export async function detectAll(): Promise<Anomaly[]> {
  const [e, o, q, eq] = await Promise.all([
    detectEnergyAnomalies(),
    detectOccupancyAnomalies(),
    detectQueueAnomalies(),
    detectEquipmentAnomalies(),
  ]);
  return [...e, ...o, ...eq, ...q];
}
