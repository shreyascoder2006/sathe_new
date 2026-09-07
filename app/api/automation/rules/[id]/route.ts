import { z } from "zod";
import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { requireOperator } from "@/backend/session";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    await requireOperator();
    const body = PatchSchema.parse(await req.json());
    const rule = await prisma.automationRule.update({
      where: { id },
      data: { enabled: body.enabled },
    });
    await prisma.activityLog.create({
      data: {
        kind: "user",
        message: `Automation rule "${rule.name}" ${body.enabled ? "enabled" : "disabled"}`,
      },
    });
    return rule;
  });
}
