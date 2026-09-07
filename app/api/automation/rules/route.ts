import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() =>
    prisma.automationRule.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { executions: true } } },
    }),
  );
}
