import { handle, fail } from "@/backend/http";
import { prisma } from "@/backend/db";
import { getBuildingsLive } from "@/backend/queries";
import { getCampusNow } from "@/backend/sim/engine";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const building = await prisma.building.findUnique({
      where: { id },
      include: {
        zones: true,
        services: { include: { queueSamples: { orderBy: { at: "desc" }, take: 1 } } },
        equipment: { orderBy: { failureRisk: "desc" } },
        incidents: { orderBy: { createdAt: "desc" }, include: { tasks: true } },
        accessRoutes: true,
      },
    });
    if (!building) throw new Error("Building not found");

    const now = await getCampusNow();
    const since = new Date(now.getTime() - 7 * 24 * 3.6e6);
    const [energy, occupancy] = await Promise.all([
      prisma.energyReading.findMany({
        where: { buildingId: id, at: { gte: since } },
        orderBy: { at: "asc" },
      }),
      prisma.occupancyReading.findMany({
        where: { buildingId: id, at: { gte: since } },
        orderBy: { at: "asc" },
      }),
    ]);

    const live = (await getBuildingsLive()).find((b) => b.id === id);

    return {
      building,
      live,
      series: {
        energy: energy.map((r) => ({ at: r.at, kwh: r.kwh, baseline: r.baseline })),
        occupancy: occupancy.map((r) => ({
          at: r.at,
          count: r.count,
          baseline: r.baseline,
          capacity: r.capacity,
        })),
      },
    };
  }).catch(() => fail("Building not found", 404));
}
