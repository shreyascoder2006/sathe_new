"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Hexagon } from "lucide-react";
import { NAV, NAV_GROUPS } from "./nav";
import { TopBar } from "./TopBar";
import { NexusAssistant } from "./NexusAssistant";
import { RoleProvider, useRole } from "./RoleProvider";
import { cx } from "@/components/ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <Shell>{children}</Shell>
    </RoleProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { config } = useRole();

  const allowed = new Set(config.nav);
  const visibleNav = NAV.filter((n) => allowed.has(n.href));

  const NavList = (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {NAV_GROUPS.map((group) => {
        const items = visibleNav.filter((n) => n.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
              {group}
            </p>
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cx(
                      "group flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                      active
                        ? "bg-[var(--blue)]/12 text-[var(--text)]"
                        : "text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--text)]",
                    )}
                  >
                    <Icon
                      className={cx(
                        "size-4 shrink-0",
                        active
                          ? "text-[var(--cyan)]"
                          : "text-[var(--text-faint)] group-hover:text-[var(--text-dim)]",
                      )}
                    />
                    {item.label}
                    {active && <span className="ml-auto size-1.5 rounded-full bg-[var(--cyan)]" />}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/40 px-2.5 py-2 text-[12px] text-[var(--text-dim)]">
        Signed in as <span className="font-semibold text-[var(--text)]">{config.label}</span>.{" "}
        {config.blurb}
      </div>
    </nav>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar onMenu={() => setOpen((v) => !v)} />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-1)]/60 lg:block">
          <BrandBlock />
          {NavList}
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-1)]">
              <div className="flex items-center justify-between px-4 py-3">
                <BrandBlock compact />
                <button onClick={() => setOpen(false)} className="text-[var(--text-dim)]">
                  <X className="size-5" />
                </button>
              </div>
              {NavList}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <NexusAssistant />
    </div>
  );
}

function BrandBlock({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cx(
        "flex items-center gap-2.5 px-4",
        compact ? "" : "border-b border-[var(--border)] py-4",
      )}
    >
      <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--blue)] to-[var(--violet)]">
        <Hexagon className="size-4 text-white" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-wide">NEXUS Campus</div>
        <div className="text-[11px] text-[var(--text-faint)]">Sathaye College · digital twin</div>
      </div>
    </div>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="lg:hidden text-[var(--text-dim)]">
      <Menu className="size-5" />
    </button>
  );
}
