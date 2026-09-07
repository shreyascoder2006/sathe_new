import { z } from "zod";
import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { shortCode } from "@/lib/format";
import { ruleExplanation } from "@/backend/ai/explain";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  return handle(() =>
    prisma.incident.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        building: true,
        assignee: true,
        tasks: true,
        execution: true,
      },
    }),
  );
}

const CreateSchema = z.object({
  title: z.string().min(4),
  type: z.enum(["energy", "occupancy", "equipment", "security", "accessibility", "queue"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  buildingId: z.string().optional(),
  summary: z.string().min(4),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = CreateSchema.parse(await req.json());
    const incident = await prisma.incident.create({
      data: {
        code: shortCode("INC"),
        title: body.title,
        type: body.type,
        severity: body.severity,
        status: "open",
        source: "manual",
        buildingId: body.buildingId || null,
        summary: body.summary,
        aiExplanation: {
          ...ruleExplanation(
            {
              type: body.type as "energy",
              severity: body.severity,
              metric: "manual",
              current: 0,
              baseline: 0,
              deviationPct: 0,
              window: "reported manually",
              unit: "",
              headline: body.title,
            },
            undefined,
          ),
        },
      },
    });
    await prisma.activityLog.create({
      data: { kind: "incident", message: `${incident.code} raised manually: ${incident.title}` },
    });
    return incident;
  });
}
