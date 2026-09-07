"use client";

import { useState } from "react";
import { Menu, Bell, ChevronDown, Hexagon, CircleDot, Check } from "lucide-react";
import { useApi, apiSend, refreshCampus } from "@/lib/client";
import { fmtClock, fmtDate, timeAgo } from "@/lib/format";
import { Badge, StatusDot, cx } from "@/components/ui";
import { useRole } from "./RoleProvider";
import { ROLE_LIST } from "@/lib/roles";

function RoleSwitcher() {
  const { config, setRole } = useRole();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/60 py-1 pl-1 pr-2"
      >
        <span
          className="grid size-7 place-items-center rounded-md text-xs font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${config.accent}, ${config.accent}55)` }}
        >
          {config.initials}
        </span>
        <span className="hidden leading-tight text-left sm:block">
          <span className="block text-xs font-semibold">{config.label}</span>
          <span className="block text-[12px] text-[var(--text-faint)]">switch persona</span>
        </span>
        <ChevronDown className="size-3.5 text-[var(--text-faint)]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-1)] shadow-2xl">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Role-based experience
            </div>
            {ROLE_LIST.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setRole(r.id);
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full items-start gap-2.5 border-b border-[var(--border)] px-3 py-2.5 text-left last:border-0 hover:bg-white/5",
                  config.id === r.id && "bg-[var(--blue)]/8",
                )}
              >
                <span
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded text-[10px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${r.accent}, ${r.accent}55)` }}
                >
                  {r.initials}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {r.label}
                    {config.id === r.id && <Check className="size-3.5 text-[var(--cyan)]" />}
                  </span>
                  <span className="block text-[12px] leading-snug text-[var(--text-dim)]">
                    {r.blurb}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface Metrics {
  campusNow: string;
  campusHealth: number;
  activeIncidents: number;
  unreadNotifications: number;
}
interface Notif {
  id: string;
  title: string;
  body: string;
  level: string;
  read: boolean;
  createdAt: string;
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { data: m } = useApi<Metrics>("/api/metrics", { refreshInterval: 20000 });
  const { data: notifs } = useApi<Notif[]>("/api/notifications", { refreshInterval: 20000 });
  const [openBell, setOpenBell] = useState(false);

  const health = m?.campusHealth ?? 0;
  const campusStatus = health >= 88 ? "nominal" : health >= 72 ? "attention" : "critical";
  const unread = m?.unreadNotifications ?? 0;

  return (
    <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-1)]/80 px-3 backdrop-blur-xl sm:px-4">
      <button onClick={onMenu} className="text-[var(--text-dim)] lg:hidden">
        <Menu className="size-5" />
      </button>

      <div className="flex items-center gap-2 lg:hidden">
        <div className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-[var(--blue)] to-[var(--violet)]">
          <Hexagon className="size-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold">NEXUS</span>
      </div>

      <div className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/60 px-2.5 py-1.5 sm:flex">
        <StatusDot status={campusStatus} pulse={campusStatus !== "nominal"} />
        <span className="text-xs text-[var(--text-dim)]">Campus status</span>
        <span className="text-xs font-semibold capitalize text-[var(--text)]">{campusStatus}</span>
        <span className="mx-1 h-3 w-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--text-dim)]">Health</span>
        <span className="text-xs font-semibold tabular-nums">{health}%</span>
      </div>

      {(m?.activeIncidents ?? 0) > 0 && (
        <Badge tone="warn" className="hidden md:inline-flex">
          <CircleDot className="size-3" /> {m?.activeIncidents} active incident
          {m && m.activeIncidents > 1 ? "s" : ""}
        </Badge>
      )}

      <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
        <div className="hidden text-right leading-tight sm:block">
          <div className="text-xs font-semibold tabular-nums text-[var(--text)]">
            {m ? fmtClock(m.campusNow) : "--:--"}
          </div>
          <div className="text-[12px] text-[var(--text-faint)]">
            {m ? fmtDate(m.campusNow) : ""} · sim clock
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenBell((v) => !v)}
            className="relative grid size-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/60 text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-[var(--bad)] px-1 text-[12px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {openBell && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenBell(false)} />
              <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-1)] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                  <span className="text-xs font-semibold">Notifications</span>
                  <button
                    className="text-[13px] text-[var(--cyan)] hover:underline"
                    onClick={async () => {
                      await apiSend("/api/notifications", "PATCH", { markAllRead: true });
                      refreshCampus();
                    }}
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {(notifs ?? []).length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-[var(--text-dim)]">
                      No notifications yet.
                    </p>
                  )}
                  {(notifs ?? []).slice(0, 12).map((n) => (
                    <div
                      key={n.id}
                      className={cx(
                        "border-b border-[var(--border)] px-3 py-2.5 last:border-0",
                        !n.read && "bg-[var(--blue)]/5",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <StatusDot
                          status={
                            n.level === "critical"
                              ? "critical"
                              : n.level === "warning"
                                ? "attention"
                                : n.level === "success"
                                  ? "nominal"
                                  : "acknowledged"
                          }
                        />
                        <span className="text-xs font-medium text-[var(--text)]">{n.title}</span>
                        <span className="ml-auto text-[12px] text-[var(--text-faint)]">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] text-[var(--text-dim)]">{n.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <RoleSwitcher />
      </div>
    </header>
  );
}
