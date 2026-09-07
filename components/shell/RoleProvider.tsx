"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ROLES, DEFAULT_ROLE, type Role, type RoleConfig } from "@/lib/roles";

interface Ctx {
  role: Role;
  config: RoleConfig;
  setRole: (r: Role) => Promise<void>;
  ready: boolean;
}

const RoleCtx = createContext<Ctx>({
  role: DEFAULT_ROLE,
  config: ROLES[DEFAULT_ROLE],
  setRole: async () => {},
  ready: false,
});

export const useRole = () => useContext(RoleCtx);

function readCookieRole(): Role {
  if (typeof document === "undefined") return DEFAULT_ROLE;
  const m = document.cookie.match(/(?:^|;\s*)nexus_role=([^;]+)/);
  const v = m?.[1];
  return v && v in ROLES ? (v as Role) : DEFAULT_ROLE;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(DEFAULT_ROLE);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setRoleState(readCookieRole());
    setReady(true);
  }, []);

  const setRole = useCallback(
    async (r: Role) => {
      setRoleState(r);
      try {
        await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role: r }),
        });
      } catch {
        /* cookie is also set client-side below as a fallback */
      }
      document.cookie = `nexus_role=${r}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      router.push(ROLES[r].landing);
      router.refresh();
    },
    [router],
  );

  return (
    <RoleCtx.Provider value={{ role, config: ROLES[role], setRole, ready }}>
      {children}
    </RoleCtx.Provider>
  );
}
