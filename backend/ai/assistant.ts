import { prisma } from "@/backend/db";
import { chatJSON, hasLLM, llmModeLabel } from "@/backend/ai/llm";
import { timeAgo } from "@/lib/format";

export interface AssistantAnswer {
  answer: string;
  sources: { label: string; href?: string }[];
  mode: string;
}

type Intent =
  | "attention"
  | "incidents"
  | "why_amber"
  | "equipment"
  | "recent"
  | "energy"
  | "queues"
  | "help";

function classify(q: string): { intent: Intent; buildingHint?: string } {
  const s = q.toLowerCase();
  const buildingHint = [
    "main", "junior", "science", "library", "admin", "exam", "canteen", "gymkhana", "security",
  ].find((k) => s.includes(k));
  if (/(why).*(amber|red|attention|critical)|why is .* showing/.test(s))
    return { intent: "why_amber", buildingHint };
  if (/(need|needs|require).*(attention|action|looking)/.test(s) || s.includes("what needs"))
    return { intent: "attention", buildingHint };
  if (/(equipment|machine|lab).*(maintenance|health|risk|fail)/.test(s) || s.includes("labpulse"))
    return { intent: "equipment", buildingHint };
  if (/last (hour|hours|day)|what happened|recent/.test(s)) return { intent: "recent", buildingHint };
  if (/energy|power|kwh|consumption|electric/.test(s)) return { intent: "energy", buildingHint };
  if (/queue|wait|counter|canteen line/.test(s)) return { intent: "queues", buildingHint };
  if (/incident|open issues|active/.test(s)) return { intent: "incidents", buildingHint };
  return { intent: "help" };
}

export async function answerQuestion(question: string): Promise<AssistantAnswer> {
  const { intent, buildingHint } = classify(question);
  let answer = "";
  const sources: AssistantAnswer["sources"] = [];

  const matchBuilding = async () => {
    if (!buildingHint) return null;
    return prisma.building.findFirst({
      where: { OR: [{ name: { contains: buildingHint } }, { shortName: { contains: buildingHint } }, { id: { contains: buildingHint } }] },
    });
  };

  if (intent === "attention" || intent === "help") {
    const buildings = await prisma.building.findMany({
      where: { status: { not: "nominal" } },
      orderBy: { healthScore: "asc" },
    });
    const incidents = await prisma.incident.count({ where: { status: { not: "resolved" } } });
    if (buildings.length === 0) {
      answer = `All 9 monitored buildings are nominal. ${incidents} incident(s) are still open but none have pushed a building out of the healthy band.`;
    } else {
      answer =
        `${buildings.length} building(s) need attention: ` +
        buildings
          .map((b) => `${b.name} (health ${b.healthScore}%, ${b.status})`)
          .join("; ") +
        `. There are ${incidents} open incident(s) overall.`;
      buildings.forEach((b) => sources.push({ label: b.name, href: `/buildings/${b.id}` }));
    }
  } else if (intent === "incidents") {
    const incs = await prisma.incident.findMany({
      where: { status: { not: "resolved" } },
      orderBy: { createdAt: "desc" },
      include: { building: true },
      take: 8,
    });
    answer = incs.length
      ? `${incs.length} active incident(s):\n` +
        incs
          .map(
            (i) =>
              `• ${i.code} — ${i.title} [${i.severity}, ${i.status}]${i.building ? ` @ ${i.building.name}` : ""}`,
          )
          .join("\n")
      : "No active incidents. Everything is currently within normal operating bands.";
    incs.forEach((i) => sources.push({ label: i.code, href: `/incidents/${i.id}` }));
  } else if (intent === "why_amber") {
    const b = await matchBuilding();
    if (!b) {
      answer = "Tell me which building — e.g. “why is the Science Block showing amber?”";
    } else {
      const incs = await prisma.incident.findMany({
        where: { buildingId: b.id, status: { not: "resolved" } },
        orderBy: { severity: "desc" },
      });
      answer =
        `${b.name} is ${b.status} (health ${b.healthScore}%). ` +
        (incs.length
          ? `Driven by ${incs.length} open incident(s): ` +
            incs.map((i) => `${i.title} (${i.severity})`).join("; ") +
            `. ${(incs[0].aiExplanation as { recommendedAction?: string } | null)?.recommendedAction ?? ""}`
          : "No open incidents are attached — status will recover on the next healthy readings.");
      sources.push({ label: b.name, href: `/buildings/${b.id}` });
    }
  } else if (intent === "equipment") {
    const risky = await prisma.equipment.findMany({
      where: { status: { in: ["monitor", "at_risk", "offline"] } },
      orderBy: { failureRisk: "desc" },
      take: 6,
    });
    answer = risky.length
      ? `Equipment to watch:\n` +
        risky
          .map(
            (e) =>
              `• ${e.name} — health ${e.healthScore}%, failure risk ${Math.round(e.failureRisk * 100)}%, ${e.status}`,
          )
          .join("\n")
      : "All tracked laboratory equipment is in the healthy band.";
    sources.push({ label: "LabPulse", href: "/labs" });
  } else if (intent === "recent") {
    const logs = await prisma.activityLog.findMany({ orderBy: { at: "desc" }, take: 8 });
    answer = logs.length
      ? logs.map((l) => `• ${timeAgo(l.at)} — ${l.message}`).join("\n")
      : "No activity recorded yet. Trigger a demo event from the Command Center.";
    sources.push({ label: "Activity log", href: "/impact" });
  } else if (intent === "energy") {
    const b = await matchBuilding();
    const readings = await prisma.energyReading.findMany({
      where: b ? { buildingId: b.id } : undefined,
      orderBy: { at: "desc" },
      take: b ? 1 : 9,
      include: { building: true },
    });
    if (b && readings[0]) {
      const r = readings[0];
      const dev = Math.round(((r.kwh - r.baseline) / r.baseline) * 100);
      answer = `${b.name} is drawing ${r.kwh} kWh this hour against an expected ${r.baseline} kWh (${dev > 0 ? "+" : ""}${dev}%).`;
      sources.push({ label: b.name, href: `/energy` });
    } else {
      const total = readings.reduce((s, r) => s + r.kwh, 0);
      answer = `Campus grid draw this hour is about ${Math.round(total)} kWh across ${readings.length} buildings. Open EnergyMind for the per-building breakdown.`;
      sources.push({ label: "EnergyMind", href: "/energy" });
    }
  } else if (intent === "queues") {
    const svcs = await prisma.service.findMany({
      where: { isQueued: true },
      orderBy: { queueLength: "desc" },
      take: 5,
    });
    answer = svcs
      .map((s) => `• ${s.name} — ${s.queueLength} in queue (${s.status})`)
      .join("\n");
    sources.push({ label: "QueueLess", href: "/queues" });
  }

  if (!answer) answer = "I can answer questions about buildings needing attention, active incidents, energy, equipment health, queues, and recent activity — all from live campus data.";

  if (hasLLM()) {
    const json = await chatJSON(
      "You are NEXUS AI for Sathaye College. Rephrase the FACTS into a concise, helpful reply. " +
        "Use ONLY the facts given — never invent campus details. Return JSON {answer: string}.",
      JSON.stringify({ question, facts: answer }),
      400,
    );
    if (json && typeof json.answer === "string") {
      return { answer: json.answer, sources, mode: llmModeLabel() };
    }
  }

  return { answer, sources, mode: "rule-based" };
}
