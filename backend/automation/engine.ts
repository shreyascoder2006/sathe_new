import { prisma } from "@/backend/db";
import type { Anomaly } from "@/backend/anomaly/detect";
import { explainAnomaly } from "@/backend/ai/explain";
import { shortCode } from "@/lib/format";
import { severityRank, statusToBuildingStatus, type Severity } from "@/lib/constants";

const TRIGGER_FOR_TYPE: Record<Anomaly["type"], string> = {
  energy: "energy_anomaly",
  occupancy: "crowd_congestion",
  equipment: "equipment_health",
  queue: "queue_buildup",
  accessibility: "lift_outage",
  security: "security_event",
};

interface Step {
  action: string;
  status: "success" | "skipped" | "failed";
  detail: string;
  at: string;
}

const INCIDENT_TYPE: Record<Anomaly["type"], string> = {
  energy: "energy",
  occupancy: "occupancy",
  equipment: "equipment",
  queue: "queue",
  accessibility: "accessibility",
  security: "security",
};

export interface AutomationResult {
  matched: boolean;
  ruleName?: string;
  incidentId?: string;
  executionId?: string;
  steps: Step[];
  createdTasks: string[];
  createdNotifications: string[];
}

function conditionsPass(
  conditions: Record<string, unknown>,
  anomaly: Anomaly,
): boolean {
  if (typeof conditions.minDeviationPct === "number") {
    if (Math.abs(anomaly.deviationPct) < conditions.minDeviationPct) return false;
  }
  if (typeof conditions.minSeverity === "string") {
    if (
      severityRank[anomaly.severity] <
      severityRank[conditions.minSeverity as Severity]
    )
      return false;
  }
  return true;
}

export async function runAutomationForAnomaly(
  anomaly: Anomaly,
): Promise<AutomationResult> {
  const trigger = TRIGGER_FOR_TYPE[anomaly.type];
  const rules = await prisma.automationRule.findMany({
    where: { trigger, enabled: true },
  });

  const now = () => new Date().toISOString();
  const steps: Step[] = [];

  if (rules.length === 0) {
    return { matched: false, steps, createdTasks: [], createdNotifications: [] };
  }

  const rule = rules.find((r) =>
    conditionsPass(r.conditions as Record<string, unknown>, anomaly),
  );
  if (!rule) {
    return { matched: false, steps, createdTasks: [], createdNotifications: [] };
  }

  const building = anomaly.buildingId
    ? await prisma.building.findUnique({ where: { id: anomaly.buildingId } })
    : null;

  const explanation = await explainAnomaly(anomaly, building?.name);
  steps.push({
    action: "analyse",
    status: "success",
    detail: `${explanation.mode === "claude" ? "Claude" : "Rule-based"} analysis attached: ${explanation.what}`,
    at: now(),
  });

  // 1. incident
  const incident = await prisma.incident.create({
    data: {
      code: shortCode("INC"),
      title: anomaly.headline,
      type: INCIDENT_TYPE[anomaly.type],
      severity: anomaly.severity,
      status: "open",
      source: "automation",
      buildingId: anomaly.buildingId ?? null,
      summary: explanation.what,
      evidence: {
        metric: anomaly.metric,
        current: anomaly.current,
        baseline: anomaly.baseline,
        unit: anomaly.unit,
        deviationPct: anomaly.deviationPct,
        window: anomaly.window,
      },
      aiExplanation: { ...explanation },
    },
  });
  steps.push({
    action: "create_incident",
    status: "success",
    detail: `Incident ${incident.code} opened (${anomaly.severity}).`,
    at: now(),
  });

  const actions = (rule.actions as { type: string; params?: Record<string, unknown> }[]) ?? [];
  const createdTasks: string[] = [];
  const createdNotifications: string[] = [];

  for (const action of actions) {
    const p = action.params ?? {};
    try {
      switch (action.type) {
        case "assign_task": {
          const team = (p.team as string) || "Facilities";
          const assignee = await prisma.user.findFirst({ where: { team } });
          const task = await prisma.maintenanceTask.create({
            data: {
              code: shortCode("TSK"),
              title: (p.title as string) || `Investigate: ${anomaly.headline}`,
              team,
              priority:
                anomaly.severity === "critical" || anomaly.severity === "high"
                  ? "high"
                  : "medium",
              status: "assigned",
              incidentId: incident.id,
              equipmentId: anomaly.equipmentId ?? null,
              assigneeId: assignee?.id ?? null,
            },
          });
          createdTasks.push(task.code);
          steps.push({
            action: "assign_task",
            status: "success",
            detail: `Task ${task.code} assigned to ${team}${assignee ? ` (${assignee.name})` : ""}.`,
            at: now(),
          });
          break;
        }
        case "notify": {
          const role = (p.role as string) || "administrator";
          const users = await prisma.user.findMany({ where: { role } });
          for (const u of users) {
            const n = await prisma.notification.create({
              data: {
                title: (p.title as string) || "Automated incident raised",
                body:
                  (p.body as string) ||
                  `${incident.code}: ${anomaly.headline}. Recommended action — ${explanation.recommendedAction}`,
                level:
                  anomaly.severity === "critical"
                    ? "critical"
                    : anomaly.severity === "high"
                      ? "warning"
                      : "info",
                incidentId: incident.id,
                userId: u.id,
              },
            });
            createdNotifications.push(n.id);
          }
          steps.push({
            action: "notify",
            status: "success",
            detail: `${users.length} ${role}(s) notified.`,
            at: now(),
          });
          break;
        }
        case "update_building_status": {
          if (building) {
            await prisma.building.update({
              where: { id: building.id },
              data: {
                status: statusToBuildingStatus(anomaly.severity),
                healthScore: Math.max(
                  40,
                  building.healthScore - (anomaly.severity === "critical" ? 22 : 12),
                ),
                ...(anomaly.type === "energy" ? { energyStatus: "attention" } : {}),
                ...(anomaly.type === "accessibility" ? { liftStatus: "out_of_service" } : {}),
              },
            });
            steps.push({
              action: "update_building_status",
              status: "success",
              detail: `${building.name} status → ${statusToBuildingStatus(anomaly.severity)}.`,
              at: now(),
            });
          } else {
            steps.push({
              action: "update_building_status",
              status: "skipped",
              detail: "No building attached to this anomaly.",
              at: now(),
            });
          }
          break;
        }
        case "recommend_route": {
          const note = (p.note as string) || "Use the secondary corridor / east entrance to bypass the affected zone.";
          await prisma.notification.create({
            data: {
              title: "Alternate route recommended",
              body: note,
              level: "info",
              incidentId: incident.id,
            },
          });
          if (building && anomaly.type === "accessibility") {
            await prisma.accessRoute.updateMany({
              where: { buildingId: building.id, stepFree: true },
              data: { available: false, note },
            });
          }
          steps.push({
            action: "recommend_route",
            status: "success",
            detail: note,
            at: now(),
          });
          break;
        }
        case "log_activity": {
          steps.push({
            action: "log_activity",
            status: "success",
            detail: "Event recorded in the campus activity log.",
            at: now(),
          });
          break;
        }
        default:
          steps.push({
            action: action.type,
            status: "skipped",
            detail: "Unknown action type.",
            at: now(),
          });
      }
    } catch (err) {
      steps.push({
        action: action.type,
        status: "failed",
        detail: err instanceof Error ? err.message : "Action failed.",
        at: now(),
      });
    }
  }

  const failed = steps.some((s) => s.status === "failed");
  const execution = await prisma.automationExecution.create({
    data: {
      ruleId: rule.id,
      trigger,
      status: failed ? "partial" : "success",
      steps: steps as unknown as object,
      incidentId: incident.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      kind: "automation",
      message: `${rule.name}: ${incident.code} raised for ${anomaly.headline}`,
      meta: {
        ruleId: rule.id,
        incidentId: incident.id,
        executionId: execution.id,
        tasks: createdTasks,
      },
    },
  });

  return {
    matched: true,
    ruleName: rule.name,
    incidentId: incident.id,
    executionId: execution.id,
    steps,
    createdTasks,
    createdNotifications,
  };
}
