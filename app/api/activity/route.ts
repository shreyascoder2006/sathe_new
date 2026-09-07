import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 25);
  return handle(() =>
    prisma.activityLog.findMany({
      orderBy: { at: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    }),
  );
}
