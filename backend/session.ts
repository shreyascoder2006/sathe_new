import { cookies } from "next/headers";
import { roleFromValue, ROLES, type Role } from "@/lib/roles";
import { fail } from "@/backend/http";

export const ROLE_COOKIE = "nexus_role";

export async function getRole(): Promise<Role> {
  const jar = await cookies();
  return roleFromValue(jar.get(ROLE_COOKIE)?.value);
}

/** Throws a Response if the current role can't operate (change state). */
export async function requireOperator() {
  const role = await getRole();
  if (!ROLES[role].canOperate) {
    throw fail(`The ${ROLES[role].label} role is read-only for this action.`, 403);
  }
  return role;
}

export async function requireSimulator() {
  const role = await getRole();
  if (!ROLES[role].canSimulate) {
    throw fail(`Only the Administrator role can run demo simulations.`, 403);
  }
  return role;
}
