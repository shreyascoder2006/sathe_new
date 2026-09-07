import { z } from "zod";
import { handle, fail } from "@/backend/http";
import { prisma } from "@/backend/db";
import { getRole } from "@/backend/session";
import { shortCode } from "@/lib/format";
import { ruleExplanation } from "@/backend/ai/explain";

export const dynamic = "force-dynamic";

const Schema = z.object({
  category: z.enum(["equipment", "accessibility", "energy", "security", "occupancy", "queue"]),
  buildingId: z.string().optional(),
  location: z.string().min(2),
  description: z.string().min(6).max(600),
  reporter: z.string().min(2),
});

/** Student / faculty issue reporting — creates a low-severity incident routed to triage.
 *  The Digital Twin auto-identifies the building; admins pick it up in Incident Management. */
export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("Please describe the issue and where it is.", 422);
  return handle(async () => {
    const role = await getRole();
    const b = parsed.data;
    const building = b.buildingId
      ? await prisma.building.findUnique({ where: { id: b.buildingId } })
      : null;

    const incident = await prisma.incident.create({
      data: {
        code: shortCode("INC"),
        title: `${b.category === "accessibility" ? "Accessibility" : b.category === "equipment" ? "Equipment" : "Facilities"} issue reported — ${b.location}`,
        type: b.category,
        severity: b.category === "security" ? "high" : "low",
        status: "open",
        source: role === "teacher" ? "manual" : "student",
        buildingId: building?.id ?? null,
        summary: b.description,
        evidence: { reportedBy: b.reporter, location: b.location, channel: role },
        aiExplanation: {
          ...ruleExplanation(
            {
              type: b.category as "equipment",
              severity: "low",
              metric: "user_report",
              current: 0,
              baseline: 0,
              deviationPct: 0,
              window: "reported by a campus user",
              unit: "",
              headline: b.description,
            },
            building?.name,
          ),
        },
      },
    });

    const admins = await prisma.user.findMany({ where: { role: "administrator" } });
    for (const u of admins) {
      await prisma.notification.create({
        data: {
          title: "New issue reported by a campus user",
          body: `${incident.code}: ${b.description} (${b.location}) — reported by ${b.reporter}.`,
          level: "info",
          incidentId: incident.id,
          userId: u.id,
        },
      });
    }
    await prisma.activityLog.create({
      data: {
        kind: "user",
        message: `${incident.code} reported by ${b.reporter} (${role}): ${b.description.slice(0, 80)}`,
      },
    });
    return { incident: { id: incident.id, code: incident.code } };
  });
}
