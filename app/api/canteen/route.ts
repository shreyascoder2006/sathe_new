import { z } from "zod";
import { handle, fail } from "@/backend/http";
import { prisma } from "@/backend/db";
import { getCampusNow, queueFor } from "@/backend/sim/engine";
import { shortCode } from "@/lib/format";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const now = await getCampusNow();
    const [menu, orders, canteen] = await Promise.all([
      prisma.menuItem.findMany({ where: { available: true }, orderBy: { station: "asc" } }),
      prisma.canteenOrder.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
      prisma.service.findFirst({ where: { name: { contains: "Canteen" } } }),
    ]);

    // demand forecast for the next lunch window from the queue model
    const windows: { at: string; predictedOrders: number; wait: number }[] = [];
    for (let h = 0; h <= 4; h++) {
      const at = new Date(now.getTime() + h * 3.6e6);
      const q = queueFor(canteen?.avgServiceMinutes ?? 1.6, at);
      windows.push({
        at: at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
        predictedOrders: Math.round(q.queueLength * 3.5 + 40),
        wait: Math.round(q.waitMinutes),
      });
    }

    return {
      campusNow: now.toISOString(),
      menu,
      orders,
      liveQueue: canteen?.queueLength ?? 0,
      demandForecast: windows,
    };
  });
}

const OrderSchema = z.object({
  items: z.array(z.object({ menuItemId: z.string(), qty: z.number().min(1).max(5) })).min(1),
  pickupInMinutes: z.number().min(10).max(180),
  placedBy: z.string().min(2),
});

export async function POST(req: Request) {
  const parsed = OrderSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("Invalid order", 422, parsed.error.flatten());
  return handle(async () => {
    const now = await getCampusNow();
    const menu = await prisma.menuItem.findMany({
      where: { id: { in: parsed.data.items.map((i) => i.menuItemId) } },
    });
    if (menu.length === 0) throw new Error("No valid menu items");
    const lines = parsed.data.items
      .map((i) => {
        const m = menu.find((x) => x.id === i.menuItemId);
        return m ? { menuItemId: m.id, name: m.name, qty: i.qty, price: m.price } : null;
      })
      .filter(Boolean) as { menuItemId: string; name: string; qty: number; price: number }[];
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const station = menu[0].station;

    const order = await prisma.canteenOrder.create({
      data: {
        code: shortCode("ORD"),
        items: lines,
        total,
        pickupAt: new Date(now.getTime() + parsed.data.pickupInMinutes * 60_000),
        station,
        placedBy: parsed.data.placedBy,
        status: "received",
      },
    });
    await prisma.activityLog.create({
      data: {
        kind: "user",
        message: `Canteen: order ${order.code} placed (${lines.reduce((s, l) => s + l.qty, 0)} items, ₹${total}) — adds to demand forecast.`,
      },
    });
    return order;
  });
}
