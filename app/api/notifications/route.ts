import { z } from "zod";
import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() =>
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { incident: true },
    }),
  );
}

const PatchSchema = z.object({
  id: z.string().optional(),
  markAllRead: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  return handle(async () => {
    const body = PatchSchema.parse(await req.json());
    if (body.markAllRead) {
      await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
      return { ok: true };
    }
    if (body.id) {
      await prisma.notification.update({ where: { id: body.id }, data: { read: true } });
      return { ok: true };
    }
    return { ok: false };
  });
}
