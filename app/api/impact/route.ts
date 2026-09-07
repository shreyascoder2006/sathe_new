import { handle } from "@/backend/http";
import { getImpact } from "@/backend/queries";
import { prisma } from "@/backend/db";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const impact = await getImpact();
    const [byType, byStatus, recentExecutions] = await Promise.all([
      prisma.incident.groupBy({ by: ["type"], _count: true }),
      prisma.incident.groupBy({ by: ["status"], _count: true }),
      prisma.automationExecution.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { rule: true, incident: true },
      }),
    ]);
    return {
      ...impact,
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      recentExecutions,
    };
  });
}
