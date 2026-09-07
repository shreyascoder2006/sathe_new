import { z } from "zod";
import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";
import { scoreMatch } from "@/backend/ai/match";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const [lost, found, matches] = await Promise.all([
      prisma.lostItem.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.foundItem.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.lostItemMatch.findMany({
        orderBy: { confidence: "desc" },
        include: { lostItem: true, foundItem: true },
      }),
    ]);
    return { lost, found, matches };
  });
}

const CATEGORIES = ["bottle", "electronics", "id_card", "keys", "clothing", "bag", "book", "other"] as const;

const Schema = z.object({
  kind: z.enum(["lost", "found"]),
  title: z.string().min(3),
  description: z.string().min(6),
  category: z.enum(CATEGORIES),
  location: z.string().min(2),
  color: z.string().optional(),
  reporter: z.string().min(2),
  imageUrl: z.string().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const b = Schema.parse(await req.json());

    if (b.kind === "lost") {
      const lost = await prisma.lostItem.create({
        data: {
          title: b.title,
          description: b.description,
          category: b.category,
          location: b.location,
          color: b.color || null,
          reportedBy: b.reporter,
          imageUrl: b.imageUrl || null,
        },
      });
      const founds = await prisma.foundItem.findMany({ where: { status: { not: "returned" } } });
      const created: string[] = [];
      let best = 0;
      for (const f of founds) {
        const ms = scoreMatch(
          { ...lost, createdAt: lost.createdAt },
          { ...f, createdAt: f.createdAt },
        );
        if (ms.confidence >= 0.4) {
          const m = await prisma.lostItemMatch.upsert({
            where: { lostItemId_foundItemId: { lostItemId: lost.id, foundItemId: f.id } },
            update: { confidence: ms.confidence, rationale: ms.rationale },
            create: {
              lostItemId: lost.id,
              foundItemId: f.id,
              confidence: ms.confidence,
              rationale: ms.rationale,
            },
          });
          created.push(m.id);
          best = Math.max(best, ms.confidence);
        }
      }
      if (created.length) {
        await prisma.lostItem.update({ where: { id: lost.id }, data: { status: "matched" } });
        await prisma.notification.create({
          data: {
            title: "Possible match for your lost item",
            body: `"${lost.title}" — ${created.length} candidate(s), best ${Math.round(best * 100)}% confidence.`,
            level: "success",
          },
        });
      }
      await prisma.activityLog.create({
        data: {
          kind: "ai",
          message: `LostLoop: "${lost.title}" reported lost — ${created.length} match(es) suggested.`,
        },
      });
      return { item: lost, matches: created.length, bestConfidence: best };
    }

    const found = await prisma.foundItem.create({
      data: {
        title: b.title,
        description: b.description,
        category: b.category,
        location: b.location,
        color: b.color || null,
        foundBy: b.reporter,
        imageUrl: b.imageUrl || null,
      },
    });
    const losts = await prisma.lostItem.findMany({ where: { status: { in: ["open", "matched"] } } });
    const created: string[] = [];
    let best = 0;
    for (const l of losts) {
      const ms = scoreMatch(
        { ...l, createdAt: l.createdAt },
        { ...found, createdAt: found.createdAt },
      );
      if (ms.confidence >= 0.4) {
        const m = await prisma.lostItemMatch.upsert({
          where: { lostItemId_foundItemId: { lostItemId: l.id, foundItemId: found.id } },
          update: { confidence: ms.confidence, rationale: ms.rationale },
          create: {
            lostItemId: l.id,
            foundItemId: found.id,
            confidence: ms.confidence,
            rationale: ms.rationale,
          },
        });
        created.push(m.id);
        best = Math.max(best, ms.confidence);
        await prisma.lostItem.update({ where: { id: l.id }, data: { status: "matched" } });
      }
    }
    await prisma.activityLog.create({
      data: {
        kind: "ai",
        message: `LostLoop: "${found.title}" logged as found — ${created.length} match(es) suggested.`,
      },
    });
    return { item: found, matches: created.length, bestConfidence: best };
  });
}
