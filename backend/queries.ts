import { prisma } from "@/backend/db";
import { getCampusNow } from "@/backend/sim/engine";
import { CATEGORY_COLORS, CAMPUS_BUILDINGS, type BuildingCategory } from "@/lib/geo/campus";
import { RUPEE_PER_KWH, STAFF_MINUTE_VALUE } from "@/lib/constants";

export interface BuildingLive {
  id: string;
  name: string;
  shortName: string;
  category: string;
  color: string;
  floors: number;
  description: string;
  approxNote: string;
  healthScore: number;
  status: string;
  energyStatus: string;
  liftStatus: string;
  energyKwh: number;
  energyBaseline: number;
  energyDeviationPct: number;
  occupancy: number;
  capacity: number;
  occupancyPct: number;
  openIncidents: number;
  layout: (typeof CAMPUS_BUILDINGS)[number] | undefined;
}

export async function getBuildingsLive(): Promise<BuildingLive[]> {
  const buildings = await prisma.building.findMany({ orderBy: { name: "asc" } });
  const out: BuildingLive[] = [];
  for (const b of buildings) {
    const [energy, occ, incidents] = await Promise.all([
      prisma.energyReading.findFirst({ where: { buildingId: b.id }, orderBy: { at: "desc" } }),
      prisma.occupancyReading.findFirst({ where: { buildingId: b.id }, orderBy: { at: "desc" } }),
      prisma.incident.count({ where: { buildingId: b.id, status: { not: "resolved" } } }),
    ]);
    const dev =
      energy && energy.baseline > 0
        ? Math.round(((energy.kwh - energy.baseline) / energy.baseline) * 100)
        : 0;
    out.push({
      id: b.id,
      name: b.name,
      shortName: b.shortName,
      category: b.category,
      color: CATEGORY_COLORS[b.category as BuildingCategory] ?? "#94A3B8",
      floors: b.floors,
      description: b.description,
      approxNote: b.approxNote,
      healthScore: b.healthScore,
      status: b.status,
      energyStatus: b.energyStatus,
      liftStatus: b.liftStatus,
      energyKwh: energy?.kwh ?? 0,
      energyBaseline: energy?.baseline ?? 0,
      energyDeviationPct: dev,
      occupancy: occ?.count ?? 0,
      capacity: occ?.capacity ?? 0,
      occupancyPct: occ && occ.capacity > 0 ? Math.round((occ.count / occ.capacity) * 100) : 0,
      openIncidents: incidents,
      layout: CAMPUS_BUILDINGS.find((x) => x.id === b.id),
    });
  }
  return out;
}

export async function getCampusMetrics() {
  const [buildings, live, incidents, tasks, notifications, executions, energyToday] =
    await Promise.all([
      prisma.building.count(),
      getBuildingsLive(),
      prisma.incident.findMany({ where: { status: { not: "resolved" } } }),
      prisma.maintenanceTask.findMany({ where: { status: { not: "done" } } }),
      prisma.notification.count({ where: { read: false } }),
      prisma.automationExecution.count(),
      (async () => {
        const now = await getCampusNow();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        return prisma.energyReading.findMany({ where: { at: { gte: dayStart } } });
      })(),
    ]);

  const now = await getCampusNow();
  const health = Math.round(
    live.reduce((s, b) => s + b.healthScore, 0) / Math.max(live.length, 1),
  );
  const energyAnomalies = live.filter((b) => b.energyDeviationPct >= 18).length;
  const wasteKwh = energyToday.reduce(
    (s, r) => s + Math.max(0, r.kwh - r.baseline * 1.05),
    0,
  );

  const resolved = await prisma.incident.findMany({
    where: { status: "resolved", resolvedAt: { not: null } },
  });
  const avgResponseMin =
    resolved.length > 0
      ? Math.round(
          resolved.reduce(
            (s, i) => s + Math.max(1, (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 60000),
            0,
          ) / resolved.length,
        )
      : 14;

  return {
    campusNow: now.toISOString(),
    campusHealth: health,
    activeIncidents: incidents.length,
    buildingsMonitored: buildings,
    energyAnomalies,
    pendingMaintenance: tasks.length,
    avgResponseMin,
    unreadNotifications: notifications,
    automationRuns: executions,
    attentionBuildings: live
      .filter((b) => b.status !== "nominal")
      .map((b) => ({ id: b.id, name: b.name, status: b.status, healthScore: b.healthScore })),
    estimatedWasteKwh: Math.round(wasteKwh),
    estimatedWasteRupees: Math.round(wasteKwh * RUPEE_PER_KWH),
  };
}

export async function getImpact() {
  const [detected, resolved, energyIncidents, tasksDone, executions, resolvedList] =
    await Promise.all([
      prisma.incident.count(),
      prisma.incident.count({ where: { status: "resolved" } }),
      prisma.incident.count({ where: { type: "energy" } }),
      prisma.maintenanceTask.count({ where: { status: "done" } }),
      prisma.automationExecution.count(),
      prisma.incident.findMany({ where: { status: "resolved", resolvedAt: { not: null } } }),
    ]);

  const avgResponseMin =
    resolvedList.length > 0
      ? Math.round(
          resolvedList.reduce(
            (s, i) => s + Math.max(1, (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 60000),
            0,
          ) / resolvedList.length,
        )
      : 14;

  // notional impact: each automated triage saves ~25 min of manual investigation
  const minutesSaved = executions * 25;
  const now = await getCampusNow();
  const dayStart = new Date(now);
  dayStart.setDate(dayStart.getDate() - 7);
  const energyRows = await prisma.energyReading.findMany({ where: { at: { gte: dayStart } } });
  const wasteKwh = energyRows.reduce((s, r) => s + Math.max(0, r.kwh - r.baseline * 1.05), 0);

  return {
    issuesDetected: detected,
    issuesResolved: resolved,
    avgResponseMin,
    energyAnomalies: energyIncidents,
    maintenanceTasks: tasksDone,
    automationRuns: executions,
    minutesSaved,
    rupeesSaved: Math.round(minutesSaved * STAFF_MINUTE_VALUE + wasteKwh * 0.35 * RUPEE_PER_KWH),
    flaggedEnergyKwh: Math.round(wasteKwh),
  };
}
