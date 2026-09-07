import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { getCampusNow } from "@/backend/sim/engine";
import { getRole } from "@/backend/session";

export const dynamic = "force-dynamic";

// demo identities
const COHORT = "SYBSc-A";
const FACULTY = "P. Joshi";

export function GET() {
  return handle(async () => {
    const role = await getRole();
    const now = await getCampusNow();
    const weekday = ((now.getDay() + 6) % 7) + 1; // 1=Mon..7=Sun -> clamp Sun to 6
    const wd = weekday > 6 ? 1 : weekday;

    const where =
      role === "teacher" ? { faculty: FACULTY } : { cohort: COHORT };
    const all = await prisma.timetableSlot.findMany({
      where,
      include: { building: true },
      orderBy: [{ weekday: "asc" }, { startHour: "asc" }],
    });
    const today = all.filter((s) => s.weekday === wd);
    const hour = now.getHours();
    const current = today.find((s) => hour >= s.startHour && hour < s.endHour) ?? null;
    const next =
      today.find((s) => s.startHour > hour) ??
      all.find((s) => s.weekday > wd) ??
      all[0] ??
      null;

    return {
      identity: role === "teacher" ? { kind: "teacher", name: FACULTY } : { kind: "student", name: COHORT },
      campusNow: now.toISOString(),
      current,
      next,
      today,
      week: all,
    };
  });
}
