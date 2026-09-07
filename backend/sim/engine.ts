import { prisma } from "@/backend/db";
import { CAMPUS_BUILDINGS } from "@/lib/geo/campus";
import {
  BUILDING_PROFILES,
  energyShape,
  occupancyShape,
  noise,
  rng,
} from "@/backend/sim/profiles";

/** kWh drawn by a building in the hour starting at `date` (simulated). */
export function energyFor(buildingId: string, date: Date, seedOffset = 0) {
  const p = BUILDING_PROFILES[buildingId];
  if (!p) return { kwh: 0, baseline: 0 };
  const hour = date.getHours();
  const weekday = date.getDay();
  const shape = energyShape(hour);
  const weekend = weekday === 0 ? 0.45 : weekday === 6 ? 0.7 : 1;
  const base = p.peakKw * (p.baseFraction + (1 - p.baseFraction) * shape) * weekend;
  const seed = Math.floor(date.getTime() / 3.6e6) + seedOffset + buildingId.length * 7;
  const baseline = Math.max(1, base);
  const kwh = Math.max(0.5, base * (1 + noise(seed, 0.06)) + noise(seed * 3, 1.5));
  return { kwh: round(kwh, 2), baseline: round(baseline, 2) };
}

export function occupancyFor(buildingId: string, date: Date, seedOffset = 0) {
  const p = BUILDING_PROFILES[buildingId];
  if (!p) return { count: 0, capacity: 0, baseline: 0 };
  const hour = date.getHours();
  const weekday = date.getDay();
  const shape = occupancyShape(hour, weekday);
  const seed = Math.floor(date.getTime() / 3.6e6) + seedOffset + buildingId.length * 13;
  const baseline = Math.round(p.capacity * shape * 0.82);
  const count = Math.max(
    0,
    Math.round(p.capacity * shape * (0.82 + noise(seed, 0.12)) + noise(seed * 5, 6)),
  );
  return { count: Math.min(count, p.capacity), capacity: p.capacity, baseline };
}

export function queueFor(avgServiceMinutes: number, date: Date, seedOffset = 0) {
  const hour = date.getHours();
  const weekday = date.getDay();
  // administrative rush: late morning + just after lunch; canteen: breaks
  const peaks = [
    { h: 10, w: 1 },
    { h: 11, w: 0.8 },
    { h: 14, w: 0.9 },
    { h: 15, w: 0.6 },
  ];
  let load = 0;
  for (const pk of peaks) load += pk.w * Math.exp(-((hour - pk.h) ** 2) / 2.2);
  if (weekday === 0) load *= 0.05;
  if (weekday === 6) load *= 0.4;
  const seed = Math.floor(date.getTime() / 1.8e6) + seedOffset;
  const queueLength = Math.max(0, Math.round(load * 14 * (0.8 + noise(seed, 0.3))));
  const waitMinutes = round(queueLength * avgServiceMinutes * (0.9 + rng(seed) * 0.3), 1);
  return { queueLength, waitMinutes };
}

export function sensorFor(
  metric: string,
  baseline: number,
  amplitude: number,
  ageMonths: number,
  date: Date,
  seedOffset = 0,
) {
  const seed = Math.floor(date.getTime() / 1.08e7) + seedOffset;
  // slow ageing drift + diurnal + noise
  const drift = (ageMonths / 60) * amplitude * 0.5;
  const diurnal = Math.sin((date.getHours() / 24) * Math.PI * 2) * amplitude * 0.4;
  const value = round(baseline + drift + diurnal + noise(seed, amplitude * 0.6), 2);
  return { value, baseline: round(baseline, 2) };
}

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Read (or lazily create) the simulated campus clock. */
export async function getCampusNow(): Promise<Date> {
  const row = await prisma.campusClock.findUnique({ where: { id: 1 } });
  if (row) return row.now;
  const now = new Date();
  await prisma.campusClock.create({ data: { id: 1, now } });
  return now;
}

export async function setCampusNow(now: Date) {
  await prisma.campusClock.upsert({
    where: { id: 1 },
    update: { now },
    create: { id: 1, now },
  });
}

/**
 * Advance the campus clock by `minutes` and append one fresh reading per
 * building / equipment / queued service at the new timestamp. Anomaly
 * multipliers can be injected for a specific building or equipment id.
 */
export async function advanceClock(
  minutes = 30,
  inject: {
    energyBuildingId?: string;
    energyMultiplier?: number;
    occupancyBuildingId?: string;
    occupancyMultiplier?: number;
    equipmentId?: string;
    equipmentMultiplier?: number;
  } = {},
) {
  const prev = await getCampusNow();
  const now = new Date(prev.getTime() + minutes * 60_000);
  await setCampusNow(now);

  const buildings = await prisma.building.findMany({ select: { id: true } });

  for (const b of buildings) {
    const e = energyFor(b.id, now);
    let kwh = e.kwh;
    if (inject.energyBuildingId === b.id && inject.energyMultiplier) {
      kwh = round(kwh * inject.energyMultiplier, 2);
    }
    await prisma.energyReading.create({
      data: {
        buildingId: b.id,
        at: now,
        kwh,
        baseline: e.baseline,
        anomalous: kwh > e.baseline * 1.25,
      },
    });

    const o = occupancyFor(b.id, now);
    let count = o.count;
    if (inject.occupancyBuildingId === b.id && inject.occupancyMultiplier) {
      count = Math.min(o.capacity, Math.round(count * inject.occupancyMultiplier));
    }
    await prisma.occupancyReading.create({
      data: {
        buildingId: b.id,
        at: now,
        count,
        capacity: o.capacity,
        baseline: o.baseline,
        anomalous: count > Math.max(o.baseline, 1) * 1.35,
      },
    });
  }

  const equipment = await prisma.equipment.findMany();
  for (const eq of equipment) {
    const s = sensorFor(
      eq.metric,
      eq.sensorBaseline,
      eq.sensorAmplitude,
      eq.ageMonths,
      now,
    );
    let value = s.value;
    if (inject.equipmentId === eq.id && inject.equipmentMultiplier) {
      value = round(value * inject.equipmentMultiplier, 2);
    }
    await prisma.sensorReading.create({
      data: {
        equipmentId: eq.id,
        at: now,
        metric: eq.metric,
        value,
        baseline: s.baseline,
        anomalous: value > s.baseline * 1.4,
      },
    });
  }

  const services = await prisma.service.findMany({ where: { isQueued: true } });
  for (const svc of services) {
    const q = queueFor(svc.avgServiceMinutes, now);
    await prisma.queueSample.create({
      data: { serviceId: svc.id, at: now, queueLength: q.queueLength, waitMinutes: q.waitMinutes },
    });
    await prisma.service.update({
      where: { id: svc.id },
      data: {
        queueLength: q.queueLength,
        status: q.queueLength > 10 ? "busy" : "open",
      },
    });
  }

  return now;
}

export { CAMPUS_BUILDINGS };
