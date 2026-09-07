import { PrismaClient } from "@prisma/client";
import { CAMPUS_BUILDINGS } from "../../lib/geo/campus";
import { BUILDING_PROFILES, EQUIPMENT_SEED, SERVICE_SEED } from "../sim/profiles";
import {
  energyFor,
  occupancyFor,
  queueFor,
  sensorFor,
} from "../sim/engine";

const prisma = new PrismaClient();

const HISTORY_DAYS = 21;

function demoNow(): Date {
  const d = new Date();
  d.setMinutes(40, 0, 0);
  d.setHours(10);
  // pull weekends back to Friday so the timetable patterns read well
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2);
  if (day === 6) d.setDate(d.getDate() - 1);
  return d;
}

async function wipe() {
  // order matters for FK integrity
  await prisma.activityLog.deleteMany();
  await prisma.automationExecution.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.maintenanceTask.deleteMany();
  await prisma.lostItemMatch.deleteMany();
  await prisma.lostItem.deleteMany();
  await prisma.foundItem.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.canteenOrder.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.queueSample.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.energyReading.deleteMany();
  await prisma.occupancyReading.deleteMany();
  await prisma.accessRoute.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.building.deleteMany();
  await prisma.user.deleteMany();
  await prisma.campusClock.deleteMany();
}

async function main() {
  console.log("Seeding NEXUS Campus…");
  await wipe();

  const now = demoNow();
  await prisma.campusClock.create({ data: { id: 1, now } });

  // ---- Users ----
  const users = await Promise.all(
    [
      { name: "Dr. A. Kulkarni", email: "principal@sathaye.nexus", role: "administrator", team: "Administration" },
      { name: "Vice Principal Desk", email: "vp@sathaye.nexus", role: "administrator", team: "Administration" },
      { name: "R. Pawar", email: "facilities.lead@sathaye.nexus", role: "facilities", team: "Facilities" },
      { name: "S. Nikam", email: "facilities.2@sathaye.nexus", role: "facilities", team: "Facilities" },
      { name: "Security Control Room", email: "security@sathaye.nexus", role: "security", team: "Security" },
      { name: "Lab Superintendent", email: "labs@sathaye.nexus", role: "lab_staff", team: "Lab Staff" },
      { name: "P. Joshi (Lab Asst.)", email: "lab.asst@sathaye.nexus", role: "lab_staff", team: "Lab Staff" },
    ].map((u) => prisma.user.create({ data: u })),
  );
  const byTeam = (t: string) => users.find((u) => u.team === t)!;

  // ---- Buildings + zones + access routes ----
  for (const b of CAMPUS_BUILDINGS) {
    await prisma.building.create({
      data: {
        id: b.id,
        name: b.name,
        shortName: b.shortName,
        category: b.category,
        description: b.description,
        floors: b.floors,
        healthScore: 88 + Math.floor(Math.random() * 10),
        status: "nominal",
      },
    });

    const zoneKinds =
      b.category === "Laboratory"
        ? ["lab", "lab", "corridor", "entrance"]
        : b.category === "Academic"
          ? ["classroom", "classroom", "corridor", "hall"]
          : b.category === "Library"
            ? ["hall", "hall", "entrance"]
            : b.category === "Dining"
              ? ["hall", "open"]
              : b.category === "Sports"
                ? ["hall", "open"]
                : ["office", "entrance"];
    for (let i = 0; i < zoneKinds.length; i++) {
      await prisma.zone.create({
        data: {
          buildingId: b.id,
          name: `${b.shortName} — ${zoneKinds[i]} ${i + 1}`,
          kind: zoneKinds[i],
          capacity: Math.round((BUILDING_PROFILES[b.id]?.capacity ?? 120) / zoneKinds.length),
        },
      });
    }

    for (const e of b.entrances) {
      await prisma.accessRoute.create({
        data: {
          buildingId: b.id,
          label: `${e.label} route`,
          entrance: e.label,
          stepFree: e.stepFree,
          available: true,
          note: e.stepFree ? "Step-free, ramp/lift access." : "Steps at entrance — use the step-free alternative.",
        },
      });
    }
  }

  // ---- Services ----
  const services = await Promise.all(
    SERVICE_SEED.map((s) =>
      prisma.service.create({
        data: {
          buildingId: s.buildingId,
          name: s.name,
          category: s.category,
          description: s.description,
          isQueued: s.isQueued,
          avgServiceMinutes: s.avgServiceMinutes,
          queueLength: 0,
          status: "open",
        },
      }),
    ),
  );

  // ---- Equipment ----
  const equipment = await Promise.all(
    EQUIPMENT_SEED.map((e, i) => {
      const installedOn = new Date(now.getTime() - e.ageMonths * 30 * 8.64e7);
      const health = Math.max(58, 99 - Math.round(e.ageMonths / 2) - Math.floor(Math.random() * 6));
      const risk = Math.min(0.9, Math.max(0.03, (100 - health) / 130 + Math.random() * 0.05));
      return prisma.equipment.create({
        data: {
          buildingId: e.buildingId,
          name: e.name,
          assetTag: `SC-${e.category.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
          category: e.category,
          location: e.location,
          installedOn,
          metric: e.metric,
          sensorBaseline: e.baseline,
          sensorAmplitude: e.amplitude,
          ageMonths: e.ageMonths,
          healthScore: health,
          failureRisk: Math.round(risk * 100) / 100,
          status: health < 68 ? "at_risk" : health < 80 ? "monitor" : "healthy",
          lastServicedAt: new Date(now.getTime() - (30 + Math.random() * 120) * 8.64e7),
          predictedServiceAt: new Date(now.getTime() + (health < 70 ? 6 : 40 + Math.random() * 40) * 8.64e7),
        },
      });
    }),
  );

  // ---- Historical readings ----
  console.log("  generating historical readings…");
  const start = new Date(now.getTime() - HISTORY_DAYS * 24 * 3.6e6);
  const energyRows: { buildingId: string; at: Date; kwh: number; baseline: number; anomalous: boolean }[] = [];
  const occRows: { buildingId: string; at: Date; count: number; capacity: number; baseline: number; anomalous: boolean }[] = [];

  for (const b of CAMPUS_BUILDINGS) {
    for (let t = start.getTime(); t <= now.getTime(); t += 3.6e6) {
      const at = new Date(t);
      const e = energyFor(b.id, at);
      energyRows.push({
        buildingId: b.id,
        at,
        kwh: e.kwh,
        baseline: e.baseline,
        anomalous: e.kwh > e.baseline * 1.25,
      });
      const o = occupancyFor(b.id, at);
      occRows.push({
        buildingId: b.id,
        at,
        count: o.count,
        capacity: o.capacity,
        baseline: o.baseline,
        anomalous: o.count > Math.max(o.baseline, 1) * 1.35,
      });
    }
  }
  for (let i = 0; i < energyRows.length; i += 1000)
    await prisma.energyReading.createMany({ data: energyRows.slice(i, i + 1000) });
  for (let i = 0; i < occRows.length; i += 1000)
    await prisma.occupancyReading.createMany({ data: occRows.slice(i, i + 1000) });

  // sensor readings every 3h
  const sensorRows: { equipmentId: string; at: Date; metric: string; value: number; baseline: number; anomalous: boolean }[] = [];
  for (const eq of equipment) {
    const seed = EQUIPMENT_SEED.find((e) => e.name === eq.name)!;
    for (let t = start.getTime(); t <= now.getTime(); t += 3 * 3.6e6) {
      const at = new Date(t);
      const s = sensorFor(seed.metric, seed.baseline, seed.amplitude, seed.ageMonths, at);
      // gentle upward drift for at-risk assets over the window
      const progress = (t - start.getTime()) / (now.getTime() - start.getTime());
      const drift = eq.status === "at_risk" ? 1 + progress * 0.28 : eq.status === "monitor" ? 1 + progress * 0.12 : 1;
      const value = Math.round(s.value * drift * 100) / 100;
      sensorRows.push({
        equipmentId: eq.id,
        at,
        metric: seed.metric,
        value,
        baseline: s.baseline,
        anomalous: value > s.baseline * 1.4,
      });
    }
  }
  for (let i = 0; i < sensorRows.length; i += 1000)
    await prisma.sensorReading.createMany({ data: sensorRows.slice(i, i + 1000) });

  // queue samples hourly 08:00–18:00
  const queueRows: { serviceId: string; at: Date; queueLength: number; waitMinutes: number }[] = [];
  for (const svc of services.filter((s) => s.isQueued)) {
    const seed = SERVICE_SEED.find((s) => s.name === svc.name)!;
    for (let t = start.getTime(); t <= now.getTime(); t += 3.6e6) {
      const at = new Date(t);
      if (at.getHours() < 8 || at.getHours() > 18) continue;
      const q = queueFor(seed.avgServiceMinutes, at);
      queueRows.push({ serviceId: svc.id, at, queueLength: q.queueLength, waitMinutes: q.waitMinutes });
    }
  }
  for (let i = 0; i < queueRows.length; i += 1000)
    await prisma.queueSample.createMany({ data: queueRows.slice(i, i + 1000) });

  // set current queueLength on services from the latest sample
  for (const svc of services.filter((s) => s.isQueued)) {
    const last = queueRows.filter((r) => r.serviceId === svc.id).at(-1);
    if (last)
      await prisma.service.update({
        where: { id: svc.id },
        data: { queueLength: last.queueLength, status: last.queueLength > 10 ? "busy" : "open" },
      });
  }

  // ---- Automation rules ----
  console.log("  automation rules…");
  await prisma.automationRule.createMany({
    data: [
      {
        name: "Energy anomaly → Facilities response",
        description:
          "When a building's grid draw exceeds its baseline by 25%+, open a maintenance incident, assign Facilities, notify administrators and flag the building.",
        trigger: "energy_anomaly",
        conditions: { minDeviationPct: 25, minSeverity: "medium" },
        actions: [
          { type: "assign_task", params: { team: "Facilities", title: "Verify AHU/chiller schedule and walk the floor for equipment left on" } },
          { type: "notify", params: { role: "administrator", title: "Energy anomaly detected" } },
          { type: "update_building_status", params: {} },
          { type: "log_activity", params: {} },
        ],
        enabled: true,
      },
      {
        name: "Crowd congestion → Security + reroute",
        description:
          "When occupancy exceeds 90% of capacity or 45% above expected, open a congestion incident, recommend an alternate route and notify Security.",
        trigger: "crowd_congestion",
        conditions: { minSeverity: "medium" },
        actions: [
          { type: "notify", params: { role: "security", title: "Crowd surge detected" } },
          { type: "recommend_route", params: { note: "Divert incoming flow to the secondary corridor and the east entrance; hold the next hall release by 2 minutes." } },
          { type: "update_building_status", params: {} },
          { type: "log_activity", params: {} },
        ],
        enabled: true,
      },
      {
        name: "Equipment health → predictive maintenance",
        description:
          "When a sensor trend stays 22%+ above baseline, raise a predictive-maintenance task for Lab Staff before the next scheduled practical.",
        trigger: "equipment_health",
        conditions: { minDeviationPct: 22 },
        actions: [
          { type: "assign_task", params: { team: "Lab Staff", title: "Inspect asset before next scheduled practical — abnormal sensor trend" } },
          { type: "notify", params: { role: "lab_staff", title: "Predictive maintenance recommended" } },
          { type: "log_activity", params: {} },
        ],
        enabled: true,
      },
      {
        name: "Lift outage → accessibility reroute",
        description:
          "When a lift becomes unavailable, update the step-free route for that building and notify affected users.",
        trigger: "lift_outage",
        conditions: {},
        actions: [
          { type: "recommend_route", params: { note: "Lift unavailable — step-free access to upper floors via the adjacent block's lift and the connecting corridor." } },
          { type: "notify", params: { role: "administrator", title: "Accessibility route updated" } },
          { type: "update_building_status", params: {} },
          { type: "log_activity", params: {} },
        ],
        enabled: true,
      },
      {
        name: "Queue buildup → open second counter",
        description:
          "When predicted wait passes 20 minutes, notify the desk to open a second position and publish an off-peak window.",
        trigger: "queue_buildup",
        conditions: {},
        actions: [
          { type: "notify", params: { role: "administrator", title: "Service queue buildup" } },
          { type: "recommend_route", params: { note: "Open a second counter position for the peak; route routine requests to the Student Services help desk." } },
          { type: "log_activity", params: {} },
        ],
        enabled: true,
      },
      {
        name: "Security event → dispatch + escalate",
        description:
          "On a restricted-area or off-hours event, open a security incident, assign the Security team and escalate to administrators.",
        trigger: "security_event",
        conditions: {},
        actions: [
          { type: "assign_task", params: { team: "Security", title: "Verify on site — restricted-area / off-hours activity" } },
          { type: "notify", params: { role: "administrator", title: "Security incident raised" } },
          { type: "update_building_status", params: {} },
          { type: "log_activity", params: {} },
        ],
        enabled: true,
      },
    ],
  });

  // ---- A few pre-existing records so screens aren't empty on first load ----
  const lib = CAMPUS_BUILDINGS.find((b) => b.id === "library")!;
  const inc1 = await prisma.incident.create({
    data: {
      code: "INC-2XK4",
      title: "Library reading hall AC underperforming",
      type: "equipment",
      severity: "medium",
      status: "in_progress",
      source: "manual",
      createdAt: new Date(now.getTime() - 22 * 3.6e6),
      buildingId: lib.id,
      summary: "Reading hall temperature 3°C above setpoint since morning; chiller pump vibration slightly elevated.",
      evidence: { metric: "temperature_c", current: 27.5, baseline: 24.5, unit: "°C", deviationPct: 12, window: "since 09:00" },
      aiExplanation: {
        what: "Reading hall is running 3°C warm; chiller pump vibration is trending up.",
        why: "Setpoint is 24.5°C and the hall has held it all month until today.",
        likelyCause: "Chiller pump bearing wear or a partially blocked strainer reducing flow.",
        impact: "Reader comfort during exam prep; risk of pump failure if ignored.",
        recommendedAction: "Facilities to inspect the chiller pump strainer and bearing today.",
        mode: "rule-based",
      },
    },
  });
  await prisma.maintenanceTask.create({
    data: {
      code: "TSK-8H2A",
      title: "Inspect library chiller pump strainer & bearing",
      team: "Facilities",
      status: "in_progress",
      priority: "medium",
      incidentId: inc1.id,
      assigneeId: byTeam("Facilities").id,
    },
  });
  await prisma.notification.create({
    data: {
      title: "Incident in progress",
      body: "INC-2XK4 — Library reading hall AC underperforming. Facilities on site.",
      level: "info",
      incidentId: inc1.id,
      userId: byTeam("Administration").id,
    },
  });

  await prisma.incident.create({
    data: {
      code: "INC-9QP1",
      title: "Photocopy kiosk queue exceeded 20 min at lunch",
      type: "queue",
      severity: "low",
      status: "resolved",
      source: "automation",
      buildingId: "canteen",
      summary: "Predicted wait hit 22 min during the 13:00 break; second position opened, cleared in 18 min.",
      evidence: { metric: "wait_time", current: 22, baseline: 12, unit: "min", deviationPct: 83, window: "13:00–13:30" },
      createdAt: new Date(now.getTime() - 21 * 3.6e6),
      resolvedAt: new Date(now.getTime() - 20 * 3.6e6),
    },
  });

  // Lost & found sample data
  const bottleLost = await prisma.lostItem.create({
    data: {
      title: "Black steel water bottle",
      description: "Black stainless steel bottle, 750ml, small dent near the base, sticker of a mountain on it. Lost near the library reading hall.",
      category: "bottle",
      location: "Central Library reading hall",
      color: "black",
      reportedBy: "Aarav S. (SYBSc)",
      status: "open",
    },
  });
  const bottleFound = await prisma.foundItem.create({
    data: {
      title: "Steel bottle left on library desk",
      description: "Dark metal water bottle found on a desk in the library, has a dent at the bottom and a sticker. Handed to circulation desk.",
      category: "bottle",
      location: "Central Library circulation desk",
      color: "black",
      foundBy: "Library staff",
      status: "stored",
    },
  });
  await prisma.foundItem.create({
    data: {
      title: "Blue umbrella near canteen",
      description: "Compact blue folding umbrella found on a bench outside the canteen.",
      category: "other",
      location: "Canteen serving court",
      color: "blue",
      foundBy: "Canteen staff",
      status: "stored",
    },
  });
  await prisma.lostItem.create({
    data: {
      title: "Scientific calculator (Casio)",
      description: "Casio FX-991 calculator, name 'Neha' written in marker on the back, lost in Science Block Physics lab 104.",
      category: "electronics",
      location: "Science Block Physics Lab 104",
      color: "grey",
      reportedBy: "Neha K. (TYBSc)",
      status: "open",
    },
  });
  const { scoreMatch } = await import("../ai/match");
  const ms = scoreMatch(
    { ...bottleLost, createdAt: bottleLost.createdAt },
    { ...bottleFound, createdAt: bottleFound.createdAt },
  );
  await prisma.lostItemMatch.create({
    data: {
      lostItemId: bottleLost.id,
      foundItemId: bottleFound.id,
      confidence: ms.confidence,
      rationale: ms.rationale,
      status: "suggested",
    },
  });

  // Activity log backfill
  await prisma.activityLog.createMany({
    data: [
      { at: new Date(now.getTime() - 26 * 3.6e6), kind: "system", message: "NEXUS Campus digital twin brought online — 9 buildings, 12 assets, 8 services monitored." },
      { at: new Date(now.getTime() - 22 * 3.6e6), kind: "incident", message: "INC-2XK4 opened — Library reading hall AC underperforming." },
      { at: new Date(now.getTime() - 20 * 3.6e6), kind: "automation", message: "Queue buildup automation resolved INC-9QP1 at the photocopy kiosk." },
      { at: new Date(now.getTime() - 3 * 3.6e6), kind: "ai", message: "NEXUS AI: morning briefing — all buildings nominal, 1 incident in progress." },
    ],
  });

  // ---- Timetable (student cohort SYBSc-A + faculty P. Joshi) ----
  console.log("  timetable + canteen…");
  const tt: {
    course: string;
    faculty: string;
    cohort: string;
    buildingId: string;
    room: string;
    weekday: number;
    startHour: number;
    endHour: number;
  }[] = [];
  const courses = [
    { course: "Data Structures", faculty: "P. Joshi", buildingId: "junior-college", room: "JC-304" },
    { course: "Physics Practical", faculty: "S. Rao", buildingId: "science-block", room: "Physics Lab 104" },
    { course: "Discrete Mathematics", faculty: "A. Menon", buildingId: "main-building", room: "MB-210" },
    { course: "Chemistry", faculty: "N. Kulkarni", buildingId: "science-block", room: "Chem Lab 201" },
    { course: "Communication Skills", faculty: "P. Joshi", buildingId: "main-building", room: "MB-Seminar Hall" },
    { course: "Computer Networks", faculty: "R. Iyer", buildingId: "junior-college", room: "Computer Lab 3F" },
  ];
  for (let wd = 1; wd <= 5; wd++) {
    let h = 8;
    for (let slot = 0; slot < 4; slot++) {
      const c = courses[(wd + slot) % courses.length];
      tt.push({ ...c, cohort: "SYBSc-A", weekday: wd, startHour: h, endHour: h + 1 });
      h += slot === 1 ? 2 : 1; // lunch after 2nd slot
    }
  }
  await prisma.timetableSlot.createMany({ data: tt });

  await prisma.menuItem.createMany({
    data: [
      { name: "Veg Thali", station: "Counter 1", price: 70, prepMins: 6 },
      { name: "Poha", station: "Counter 1", price: 30, prepMins: 3 },
      { name: "Misal Pav", station: "Counter 1", price: 50, prepMins: 5 },
      { name: "Grilled Sandwich", station: "Counter 2", price: 45, prepMins: 4 },
      { name: "Vada Pav", station: "Counter 2", price: 20, prepMins: 2 },
      { name: "Pav Bhaji", station: "Counter 2", price: 60, prepMins: 6 },
      { name: "Masala Chai", station: "Beverages", price: 12, prepMins: 2 },
      { name: "Cold Coffee", station: "Beverages", price: 40, prepMins: 3 },
      { name: "Fresh Lime Soda", station: "Beverages", price: 25, prepMins: 2 },
    ],
  });

  console.log(
    `Done. ${energyRows.length} energy + ${occRows.length} occupancy + ${sensorRows.length} sensor + ${queueRows.length} queue readings, ${tt.length} timetable slots.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
