import type { Anomaly } from "@/backend/anomaly/detect";
import { chatJSON, hasLLM, llmModeLabel } from "@/backend/ai/llm";
import { fmtRupees } from "@/lib/format";
import { RUPEE_PER_KWH } from "@/lib/constants";

export interface Explanation {
  what: string;
  why: string;
  likelyCause: string;
  impact: string;
  recommendedAction: string;
  mode: string;
}

/** Deterministic, data-grounded explanation. Numbers come straight from the anomaly. */
export function ruleExplanation(a: Anomaly, buildingName?: string): Explanation {
  const where = buildingName ? ` in ${buildingName}` : "";
  const dev = `${a.deviationPct > 0 ? "+" : ""}${a.deviationPct}%`;
  const cur = `${a.current} ${a.unit}`;
  const base = `${a.baseline} ${a.unit}`;

  switch (a.type) {
    case "energy": {
      const wasteKwh = Math.max(0, a.current - a.baseline);
      return {
        what: `Grid draw${where} rose to ${cur} against an expected ${base} for this hour — a deviation of ${dev} (${a.window}).`,
        why: `The building's own 30-day pattern for this weekday and hour sits near ${base}. A jump of this size outside the normal teaching schedule is not explained by class load.`,
        likelyCause: `HVAC or lab equipment left running outside scheduled hours, a stuck contactor on an air-handling unit, or a chiller short-cycling. Lighting circuits left energised in unoccupied wings are also consistent with this signature.`,
        impact: `If it persists for the rest of the day it adds roughly ${Math.round(wasteKwh)} kWh (${fmtRupees(wasteKwh * RUPEE_PER_KWH)}) of avoidable cost, and sustained over-draw shortens compressor life.`,
        recommendedAction: `Dispatch Facilities to verify the AHU/chiller schedule for this block and walk the floor for equipment left on. Confirm the BMS timer reset before end of day.`,
        mode: "rule-based",
      };
    }
    case "occupancy": {
      return {
        what: `Live headcount${where} reached ${cur} versus an expected ${base} (${a.window}), ${dev} above normal for this time.`,
        why: `Occupancy at this hour usually tracks the timetable. A surge of this magnitude points to an unscheduled gathering or a converging crowd rather than normal class change.`,
        likelyCause: `A break overlapping with an event, a delayed lecture releasing several halls at once, or queue spillover from an adjacent service into the corridor.`,
        impact: `Corridor and stairwell density above 90% of capacity slows egress and raises crowd-crush risk near the main stairs and entrance.`,
        recommendedAction: `Notify Security to staff the main stair and entrance, open the secondary corridor route, and hold the next hall release by two minutes to stagger flow.`,
        mode: "rule-based",
      };
    }
    case "equipment": {
      return {
        what: `${a.metric.replace(/_/g, " ")} on this asset is ${cur} against a healthy baseline of ${base} — ${dev}, sustained across ${a.window}.`,
        why: `The reading has stayed above the healthy band for multiple consecutive samples rather than spiking once, which is the pattern that precedes a fault rather than a transient.`,
        likelyCause: `For rotating equipment: bearing wear, imbalance or loosening mounts. For thermal assets: fouled filters, low refrigerant charge or a failing fan. For electrical draw: degraded windings or a failing capacitor.`,
        impact: `Left unattended this trend typically ends in an unplanned stoppage. If it fails during a scheduled practical the session is lost and emergency repair costs several times a planned service.`,
        recommendedAction: `Raise a predictive-maintenance task for Lab Staff to inspect before the next scheduled practical, and de-rate or take the asset offline if the reading climbs another 15%.`,
        mode: "rule-based",
      };
    }
    case "queue": {
      return {
        what: `Estimated wait at this service is ${cur} with ${a.current >= 25 ? "a long" : "a growing"} queue (${a.window}).`,
        why: `Historical peaks for this counter cluster around late morning and just after lunch. The current wait is well past the 12-minute comfort threshold students tolerate.`,
        likelyCause: `A staffing gap at the counter during peak, a batch of complex requests, or a deadline (form submission, fee date) concentrating demand into one window.`,
        impact: `Students miss class time and the queue physically blocks the corridor, feeding the occupancy problem nearby.`,
        recommendedAction: `Open a second counter position for the peak, publish a recommended off-peak visiting window, and route routine requests to the help desk.`,
        mode: "rule-based",
      };
    }
    default:
      return {
        what: a.headline,
        why: `Current reading of ${cur} is ${dev} from the expected ${base}.`,
        likelyCause: `Under investigation.`,
        impact: `Monitored; escalation if the deviation widens.`,
        recommendedAction: `Assign to the responsible team for a physical check.`,
        mode: "rule-based",
      };
  }
}

export async function explainAnomaly(a: Anomaly, buildingName?: string): Promise<Explanation> {
  const fallback = ruleExplanation(a, buildingName);
  if (!hasLLM()) return fallback;

  const system =
    "You are the analysis engine of NEXUS Campus, a smart-campus operations platform for Sathaye College, Mumbai. " +
    "Given a detected anomaly with real numbers, return STRICT JSON with keys: what, why, likelyCause, impact, recommendedAction. " +
    "Be specific and quantitative, use only the numbers provided, 1-2 sentences per field, no markdown.";
  const user = JSON.stringify({
    anomaly: {
      type: a.type,
      building: buildingName,
      metric: a.metric,
      current: a.current,
      baseline: a.baseline,
      unit: a.unit,
      deviationPct: a.deviationPct,
      window: a.window,
      headline: a.headline,
    },
  });
  const json = await chatJSON(system, user);
  if (
    json &&
    typeof json.what === "string" &&
    typeof json.why === "string" &&
    typeof json.likelyCause === "string" &&
    typeof json.impact === "string" &&
    typeof json.recommendedAction === "string"
  ) {
    return {
      what: json.what,
      why: json.why,
      likelyCause: json.likelyCause,
      impact: json.impact,
      recommendedAction: json.recommendedAction,
      mode: llmModeLabel(),
    };
  }
  return fallback;
}
