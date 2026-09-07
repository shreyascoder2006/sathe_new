import { handle } from "@/backend/http";
import { prisma } from "@/backend/db";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => prisma.user.findMany({ orderBy: { name: "asc" } }));
}
