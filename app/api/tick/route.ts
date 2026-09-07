import { handle } from "@/backend/http";
import { advanceClock, getCampusNow } from "@/backend/sim/engine";
import { prisma } from "@/backend/db";
import { requireOperator } from "@/backend/session";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => {
    await requireOperator();
    const now = await advanceClock(30);
    await prisma.activityLog.create({
      data: { kind: "system", message: `Campus clock advanced to ${now.toLocaleString("en-IN")}` },
    });
    return { campusNow: now.toISOString() };
  });
}

export function GET() {
  return handle(async () => ({ campusNow: (await getCampusNow()).toISOString() }));
}
