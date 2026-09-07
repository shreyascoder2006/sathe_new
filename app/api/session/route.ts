import { z } from "zod";
import { cookies } from "next/headers";
import { ok, fail } from "@/backend/http";
import { ROLE_COOKIE, getRole } from "@/backend/session";
import { ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const role = await getRole();
  return ok({ role, config: ROLES[role] });
}

const Schema = z.object({ role: z.enum(["admin", "maintenance", "security", "teacher", "student"]) });

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("Unknown role", 422);
  const jar = await cookies();
  jar.set(ROLE_COOKIE, parsed.data.role, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return ok({ role: parsed.data.role, config: ROLES[parsed.data.role] });
}
