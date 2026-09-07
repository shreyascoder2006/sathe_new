export const SEVERITY = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITY)[number];

export const INCIDENT_STATUS = ["open", "acknowledged", "in_progress", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUS)[number];

export const TASK_STATUS = ["assigned", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

export const TEAMS = ["Facilities", "Security", "Lab Staff", "Administration"] as const;
export type Team = (typeof TEAMS)[number];

export const BUILDING_STATUS = ["nominal", "attention", "critical"] as const;

export const SIM_SCENARIOS = [
  "energy_anomaly",
  "crowd_surge",
  "equipment_issue",
  "lift_outage",
  "lost_item_match",
  "queue_buildup",
  "security_event",
] as const;
export type SimScenario = (typeof SIM_SCENARIOS)[number];

export const RUPEE_PER_KWH = 9.5; // approx commercial tariff, Mumbai
export const STAFF_MINUTE_VALUE = 6; // ₹/min notionally saved per avoided manual triage

export const severityRank: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const statusToBuildingStatus = (severity: Severity) =>
  severity === "critical" || severity === "high" ? "critical" : "attention";
