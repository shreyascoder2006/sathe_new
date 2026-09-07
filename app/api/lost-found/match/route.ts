import { z } from "zod";
import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";

export const dynamic = "force-dynamic";

const Schema = z.object({
  matchId: z.string(),
  action: z.enum(["confirm", "reject", "claim"]),
});

export async function POST(req: Request) {
  return handle(async () => {
    const { matchId, action } = Schema.parse(await req.json());
    const match = await prisma.lostItemMatch.findUnique({
      where: { id: matchId },
      include: { lostItem: true, foundItem: true },
    });
    if (!match) throw new Error("Match not found");

    if (action === "reject") {
      await prisma.lostItemMatch.update({ where: { id: matchId }, data: { status: "rejected" } });
      const remaining = await prisma.lostItemMatch.count({
        where: { lostItemId: match.lostItemId, status: { in: ["suggested", "confirmed"] } },
      });
      if (remaining === 0)
        await prisma.lostItem.update({ where: { id: match.lostItemId }, data: { status: "open" } });
      return { ok: true, status: "rejected" };
    }

    if (action === "confirm") {
      await prisma.lostItemMatch.update({ where: { id: matchId }, data: { status: "confirmed" } });
      await prisma.lostItem.update({ where: { id: match.lostItemId }, data: { status: "matched" } });
      await prisma.foundItem.update({ where: { id: match.foundItemId }, data: { status: "matched" } });
      await prisma.activityLog.create({
        data: {
          kind: "user",
          message: `LostLoop: match confirmed — "${match.lostItem.title}" ↔ "${match.foundItem.title}".`,
        },
      });
      return { ok: true, status: "confirmed" };
    }

    // claim
    await prisma.lostItemMatch.update({ where: { id: matchId }, data: { status: "confirmed" } });
    await prisma.lostItem.update({ where: { id: match.lostItemId }, data: { status: "claimed" } });
    await prisma.foundItem.update({ where: { id: match.foundItemId }, data: { status: "returned" } });
    await prisma.activityLog.create({
      data: {
        kind: "user",
        message: `LostLoop: "${match.foundItem.title}" returned to owner and closed.`,
      },
    });
    return { ok: true, status: "claimed" };
  });
}
