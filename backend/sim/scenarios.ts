import { prisma } from "@/backend/db";
import { advanceClock } from "@/backend/sim/engine";
import {
  detectEnergyAnomalies,
  detectOccupancyAnomalies,
  detectEquipmentAnomalies,
  detectQueueAnomalies,
  type Anomaly,
} from "@/backend/anomaly/detect";
import { runAutomationForAnomaly, type AutomationResult } from "@/backend/automation/engine";
import { scoreMatch } from "@/backend/ai/match";
import { shortCode } from "@/lib/format";
import type { SimScenario } from "@/lib/constants";

export interface ScenarioResult {
  scenario: SimScenario;
  headline: string;
  anomalies: Anomaly[];
  automation: AutomationResult[];
  extra?: Record<string, unknown>;
}

export async function runScenario(scenario: SimScenario): Promise<ScenarioResult> {
  switch (scenario) {
    case "energy_anomaly": {
      const target =
        (await prisma.building.findFirst({ where: { id: "science-block" } })) ??
        (await prisma.building.findFirst());
      await advanceClock(30, { energyBuildingId: target!.id, energyMultiplier: 1.42 });
      await advanceClock(30, { energyBuildingId: target!.id, energyMultiplier: 1.46 });
      const anomalies = await detectEnergyAnomalies(target!.id);
      const automation = await runAll(anomalies);
      await log("simulation", `Demo: simulated energy anomaly in ${target!.name}.`);
      return { scenario, headline: `Energy anomaly injected in ${target!.name}`, anomalies, automation };
    }
    case "crowd_surge": {
      const target =
        (await prisma.building.findFirst({ where: { id: "main-building" } })) ??
        (await prisma.building.findFirst());
      await advanceClock(30, { occupancyBuildingId: target!.id, occupancyMultiplier: 1.9 });
      await advanceClock(20, { occupancyBuildingId: target!.id, occupancyMultiplier: 2.1 });
      const anomalies = await detectOccupancyAnomalies(target!.id);
      const automation = await runAll(anomalies);
      await log("simulation", `Demo: simulated crowd surge near ${target!.name}.`);
      return { scenario, headline: `Crowd surge injected at ${target!.name}`, anomalies, automation };
    }
    case "equipment_issue": {
      const eq =
        (await prisma.equipment.findFirst({ where: { name: { contains: "CNC" } } })) ??
        (await prisma.equipment.findFirst({ orderBy: { failureRisk: "desc" } }));
      for (let i = 0; i < 4; i++)
        await advanceClock(30, { equipmentId: eq!.id, equipmentMultiplier: 1.5 + i * 0.06 });
      await prisma.equipment.update({
        where: { id: eq!.id },
        data: {
          healthScore: Math.max(45, eq!.healthScore - 22),
          failureRisk: Math.min(0.95, eq!.failureRisk + 0.3),
          status: "at_risk",
          predictedServiceAt: new Date(Date.now() + 3 * 8.64e7),
        },
      });
      const anomalies = await detectEquipmentAnomalies(eq!.id);
      const automation = await runAll(anomalies);
      await log("simulation", `Demo: simulated abnormal sensor pattern on ${eq!.name}.`);
      return { scenario, headline: `Equipment issue injected: ${eq!.name}`, anomalies, automation };
    }
    case "lift_outage": {
      const target =
        (await prisma.building.findFirst({ where: { id: "science-block" } })) ??
        (await prisma.building.findFirst({ where: { liftStatus: { not: "none" } } }));
      await prisma.building.update({
        where: { id: target!.id },
        data: { liftStatus: "out_of_service", status: "attention" },
      });
      const anomaly: Anomaly = {
        type: "accessibility",
        severity: "high",
        buildingId: target!.id,
        metric: "lift_status",
        current: 0,
        baseline: 1,
        deviationPct: -100,
        window: "now",
        unit: "state",
        headline: `Lift out of service in ${target!.name} — upper floors not step-free`,
      };
      const automation = [await runAutomationForAnomaly(anomaly)];
      await log("simulation", `Demo: simulated lift outage in ${target!.name}.`);
      return { scenario, headline: `Lift outage injected: ${target!.name}`, anomalies: [anomaly], automation };
    }
    case "queue_buildup": {
      const svc =
        (await prisma.service.findFirst({ where: { name: { contains: "Examination" } } })) ??
        (await prisma.service.findFirst({ where: { isQueued: true } }));
      const wait = svc!.avgServiceMinutes * 8;
      await prisma.queueSample.create({
        data: { serviceId: svc!.id, at: new Date(), queueLength: 26, waitMinutes: Math.max(28, wait) },
      });
      await prisma.service.update({ where: { id: svc!.id }, data: { queueLength: 26, status: "busy" } });
      const anomalies = await detectQueueAnomalies(svc!.id);
      const automation = await runAll(anomalies);
      await log("simulation", `Demo: simulated queue buildup at ${svc!.name}.`);
      return { scenario, headline: `Queue buildup injected: ${svc!.name}`, anomalies, automation };
    }
    case "security_event": {
      const target = await prisma.building.findFirst({ where: { id: "science-block" } });
      const anomaly: Anomaly = {
        type: "security",
        severity: "high",
        buildingId: target!.id,
        metric: "restricted_access",
        current: 1,
        baseline: 0,
        deviationPct: 100,
        window: "off-hours",
        unit: "event",
        headline: `Unusual activity near a restricted laboratory in ${target!.name} outside scheduled hours`,
      };
      const automation = [await runAutomationForAnomaly(anomaly)];
      await log("simulation", `Demo: simulated restricted-area security event in ${target!.name} (simulation only).`);
      return { scenario, headline: `Security event injected: ${target!.name}`, anomalies: [anomaly], automation };
    }
    case "lost_item_match": {
      const lost = await prisma.lostItem.create({
        data: {
          title: "Blue college bag",
          description: "Blue backpack with a laptop sleeve and a broken side zip, lost near the canteen serving court around lunch.",
          category: "bag",
          location: "Canteen serving court",
          color: "blue",
          reportedBy: "Demo student",
          status: "open",
        },
      });
      const found = await prisma.foundItem.create({
        data: {
          title: "Backpack handed in at canteen",
          description: "Dark blue backpack found on a chair near the canteen counter, side zip is broken, contains a laptop sleeve.",
          category: "bag",
          location: "Canteen counter",
          color: "blue",
          foundBy: "Canteen staff",
          status: "stored",
        },
      });
      const ms = scoreMatch(
        { ...lost, createdAt: lost.createdAt },
        { ...found, createdAt: found.createdAt },
      );
      const match = await prisma.lostItemMatch.create({
        data: {
          lostItemId: lost.id,
          foundItemId: found.id,
          confidence: ms.confidence,
          rationale: ms.rationale,
          status: "suggested",
        },
      });
      await prisma.lostItem.update({ where: { id: lost.id }, data: { status: "matched" } });
      await prisma.notification.create({
        data: {
          title: "Possible match found for your lost item",
          body: `"${lost.title}" — ${Math.round(ms.confidence * 100)}% confidence match with an item at the canteen counter. ${ms.rationale}.`,
          level: "success",
        },
      });
      await prisma.activityLog.create({
        data: {
          kind: "ai",
          message: `LostLoop: ${Math.round(ms.confidence * 100)}% match suggested for "${lost.title}".`,
          meta: { matchId: match.id },
        },
      });
      return {
        scenario,
        headline: `Lost-item match suggested (${Math.round(ms.confidence * 100)}%)`,
        anomalies: [],
        automation: [],
        extra: { matchId: match.id, confidence: ms.confidence, lostId: lost.id, foundId: found.id },
      };
    }
    default:
      return { scenario, headline: "Unknown scenario", anomalies: [], automation: [] };
  }
}

async function runAll(anomalies: Anomaly[]): Promise<AutomationResult[]> {
  const results: AutomationResult[] = [];
  for (const a of anomalies) results.push(await runAutomationForAnomaly(a));
  return results;
}

async function log(kind: string, message: string) {
  await prisma.activityLog.create({ data: { kind, message } });
}

export { shortCode };
