import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 20);
  return handle(() =>
    prisma.automationExecution.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 60),
      include: {
        rule: true,
        incident: { include: { building: true, tasks: true, notifications: true } },
      },
    }),
  );
}
