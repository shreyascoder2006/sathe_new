"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronRight,
  X,
  CloudSun,
  Cpu,
  Eye,
  Brain,
  TrendingUp,
  PlayCircle,
  Hand,
} from "lucide-react";
import { useApi } from "@/lib/client";
import { useCampus } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { CampusView } from "@/components/campus/CampusView";
import { HudPanel, HudStat } from "@/components/ui/Hud";
import { BuildingIntelPanel } from "@/components/panels/BuildingIntelPanel";
import { DemoSimulationPanel } from "@/components/panels/DemoSimulationPanel";
import { Badge, StatusDot, Skeleton, severityTone, cx } from "@/components/ui";
import { NAV } from "@/components/shell/nav";
import { useRole } from "@/components/shell/RoleProvider";

interface Metrics {
  campusHealth: number;
  activeIncidents: number;
  buildingsMonitored: number;
  energyAnomalies: number;
  pendingMaintenance: number;
  avgResponseMin: number;
  automationRuns: number;
  estimatedWasteRupees: number;
  attentionBuildings: { id: string; name: string; status: string; healthScore: number }[];
}
interface Incident {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  type: string;
  createdAt: string;
  building?: { name: string } | null;
}
interface ActivityRow {
  id: string;
  at: string;
  kind: string;
  message: string;
}

const PIPELINE = [
  { icon: Eye, label: "See", hint: "CCTV-derived + IoT signals" },
  { icon: Brain, label: "Understand", hint: "cross-system context" },
  { icon: TrendingUp, label: "Predict", hint: "anomalies & demand" },
  { icon: PlayCircle, label: "Simulate", hint: "what-if scenarios" },
  { icon: Hand, label: "Act", hint: "automated workflows" },
];

export function CommandCenter() {
  const { data: m } = useApi<Metrics>("/api/metrics", { refreshInterval: 15000 });
  const { data: incidents } = useApi<Incident[]>("/api/incidents?status=open", {
    refreshInterval: 15000,
  });
  const { data: activity } = useApi<ActivityRow[]>("/api/activity?limit=8", {
    refreshInterval: 12000,
  });
  const selectedId = useCampus((s) => s.selectedBuildingId);
  const select = useCampus((s) => s.select);
  const { config } = useRole();
  const [showDemo, setShowDemo] = useState(false);

  const openIncidents = (incidents ?? []).filter((i) => i.status !== "resolved");

  return (
    <div className="relative flex h-full flex-col lg:h-[calc(100dvh-3.5rem)]">
      {/* 3D layer — single instance, overlaid on desktop, inline on mobile */}
      <div className="relative h-[46vh] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
        <CampusView />
      </div>

      {/* ===== desktop HUD overlay ===== */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        {/* top pipeline strip */}
        <div className="absolute left-1/2 top-3 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[var(--border)] bg-black/50 px-2 py-1.5 backdrop-blur">
            <span className="px-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--cyan)]">
              Smart Campus 360
            </span>
            <span className="h-4 w-px bg-[var(--border)]" />
            {PIPELINE.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.label} className="flex items-center">
                  <div
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-[var(--text-dim)]"
                    title={p.hint}
                  >
                    <Icon className="size-3.5 text-[var(--cyan)]/80" />
                    {p.label}
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <ChevronRight className="size-3 text-[var(--text-faint)]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* left column */}
        <div className="pointer-events-auto absolute bottom-16 left-4 top-16 flex w-[272px] flex-col gap-3 overflow-y-auto pr-1">
          <HudPanel title="Campus Overview" titleEn="live status">
            {!m ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <HudStat
                    label="Campus health"
                    value={`${m.campusHealth}%`}
                    tone={m.campusHealth >= 85 ? "var(--ok)" : "var(--warn)"}
                  />
                  <HudStat label="Active incidents" value={m.activeIncidents} tone="var(--warn)" />
                  <HudStat label="Buildings" value={m.buildingsMonitored} />
                  <HudStat label="Energy anomalies" value={m.energyAnomalies} tone="var(--bad)" />
                  <HudStat label="Pending tasks" value={m.pendingMaintenance} />
                  <HudStat label="Avg response" value={m.avgResponseMin} unit="min" />
                </div>
                <div className="mt-2 flex items-center justify-between rounded-md border border-[var(--border)] bg-black/30 px-2.5 py-1.5 text-[13px]">
                  <span className="text-[var(--text-dim)]">Automation runs</span>
                  <span className="font-semibold text-[var(--cyan)]">{m.automationRuns}</span>
                </div>
              </>
            )}
          </HudPanel>

          <HudPanel
            title="Anomalies & Alerts"
            titleEn={`${openIncidents.length} open`}
            right={
              <Link href="/incidents" className="text-[12px] text-[var(--cyan)] hover:underline">
                all
              </Link>
            }
          >
            {!incidents ? (
              <Skeleton className="h-16 w-full" />
            ) : openIncidents.length === 0 ? (
              <p className="py-2 text-[13px] text-[var(--text-dim)]">
                No open anomalies. Campus operating within normal bands.
              </p>
            ) : (
              <div className="space-y-1.5">
                {openIncidents.slice(0, 5).map((i) => (
                  <Link
                    key={i.id}
                    href={`/incidents/${i.id}`}
                    className="block rounded-md border border-[var(--border)] bg-black/25 px-2.5 py-1.5 hover:border-[var(--border-strong)]"
                  >
                    <div className="flex items-center gap-1.5">
                      <Badge tone={severityTone(i.severity)}>{i.severity}</Badge>
                      <span className="truncate text-[13px] font-medium">{i.title}</span>
                    </div>
                    <div className="mt-0.5 text-[13px] text-[var(--text-faint)]">
                      {i.code} · {i.building?.name ?? "campus"} · {timeAgo(i.createdAt)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </HudPanel>

          {m && m.attentionBuildings.length > 0 && (
            <HudPanel title="Buildings Needing Attention">
              <div className="space-y-1">
                {m.attentionBuildings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => select(b.id)}
                    className="flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-black/25 px-2.5 py-1.5 text-left hover:border-[var(--border-strong)]"
                  >
                    <StatusDot status={b.status} pulse />
                    <span className="truncate text-[13px]">{b.name}</span>
                    <span className="ml-auto text-[12px] tabular-nums text-[var(--text-dim)]">
                      {b.healthScore}%
                    </span>
                  </button>
                ))}
              </div>
            </HudPanel>
          )}
        </div>

        {/* right column */}
        <div className="pointer-events-auto absolute bottom-16 right-4 top-16 flex w-[320px] flex-col gap-3 overflow-y-auto pl-1">
          {selectedId ? (
            <HudPanel
              title="Building Intelligence"
              right={
                <button onClick={() => select(null)} className="text-[var(--text-dim)] hover:text-white">
                  <X className="size-3.5" />
                </button>
              }
            >
              <BuildingIntelPanel buildingId={selectedId} />
            </HudPanel>
          ) : (
            <HudPanel title="Campus Intelligence" titleEn="select a building">
              <p className="text-[13px] leading-relaxed text-[var(--text-dim)]">
                Click any building in the digital twin to open its live intelligence —
                energy, occupancy, incidents, equipment health and accessibility. Use the
                overlay toggles to paint energy, crowd density or accessibility onto the campus.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-md border border-[var(--border)] bg-black/25 px-2.5 py-2 text-[13px]">
                <CloudSun className="size-4 text-[var(--warn)]" />
                <span className="text-[var(--text-dim)]">Vile Parle East</span>
                <span className="ml-auto font-semibold">31°C · Clear</span>
              </div>
            </HudPanel>
          )}

          <HudPanel
            title="Recent Automated Actions"
            right={
              <Link href="/automation" className="text-[12px] text-[var(--cyan)] hover:underline">
                center
              </Link>
            }
          >
            {!activity ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-1.5">
                {activity.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex gap-2 text-[13px]">
                    <span
                      className="mt-1 size-1.5 shrink-0 rounded-full"
                      style={{
                        background:
                          a.kind === "automation"
                            ? "var(--cyan)"
                            : a.kind === "incident"
                              ? "var(--warn)"
                              : a.kind === "ai"
                                ? "var(--violet)"
                                : "var(--text-faint)",
                      }}
                    />
                    <div>
                      <p className="leading-snug text-[var(--text-dim)]">{a.message}</p>
                      <span className="text-[13px] text-[var(--text-faint)]">{timeAgo(a.at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </HudPanel>
        </div>

        {/* bottom module dock */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[var(--border)] bg-black/55 px-2 py-1.5 backdrop-blur">
            {NAV.filter((n) => n.group === "Intelligence" || n.group === "Services").map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-dim)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                >
                  <Icon className="size-3.5" />
                  <span className="hidden xl:inline">{n.label}</span>
                </Link>
              );
            })}
            {config.canSimulate && (
              <>
                <span className="mx-1 h-4 w-px bg-[var(--border)]" />
                <button
                  onClick={() => setShowDemo((v) => !v)}
                  className={cx(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    showDemo
                      ? "bg-[var(--cyan)]/20 text-[var(--cyan)]"
                      : "text-[var(--text-dim)] hover:bg-white/5",
                  )}
                >
                  <Cpu className="size-3.5" />
                  Demo
                </button>
              </>
            )}
          </div>
        </div>

        {/* demo drawer */}
        {showDemo && config.canSimulate && (
          <div className="pointer-events-auto absolute bottom-16 left-1/2 w-[320px] -translate-x-1/2">
            <DemoSimulationPanel compact />
          </div>
        )}
      </div>

      {/* ===== mobile stacked ===== */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 lg:hidden">
        <MobileOverview m={m} />
        {selectedId && (
          <HudPanel
            title="Building Intelligence"
            right={
              <button onClick={() => select(null)} className="text-[var(--text-dim)]">
                <X className="size-3.5" />
              </button>
            }
          >
            <BuildingIntelPanel buildingId={selectedId} />
          </HudPanel>
        )}
        <HudPanel title="Anomalies & Alerts">
          {openIncidents.length === 0 ? (
            <p className="text-[13px] text-[var(--text-dim)]">No open anomalies.</p>
          ) : (
            <div className="space-y-1.5">
              {openIncidents.slice(0, 6).map((i) => (
                <Link
                  key={i.id}
                  href={`/incidents/${i.id}`}
                  className="block rounded-md border border-[var(--border)] bg-black/25 px-2.5 py-1.5"
                >
                  <Badge tone={severityTone(i.severity)}>{i.severity}</Badge>{" "}
                  <span className="text-[13px]">{i.title}</span>
                </Link>
              ))}
            </div>
          )}
        </HudPanel>
        {config.canSimulate && <DemoSimulationPanel />}
        <div className="grid grid-cols-2 gap-2">
          {NAV.filter((n) => n.group !== "Campus" && config.nav.includes(n.href)).map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-1)]/70 px-3 py-2.5 text-xs"
              >
                <Icon className="size-4 text-[var(--cyan)]" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileOverview({ m }: { m?: Metrics }) {
  if (!m) return <Skeleton className="h-24 w-full" />;
  return (
    <HudPanel title="Campus Overview">
      <div className="grid grid-cols-3 gap-2">
        <HudStat label="Health" value={`${m.campusHealth}%`} tone="var(--ok)" />
        <HudStat label="Incidents" value={m.activeIncidents} tone="var(--warn)" />
        <HudStat label="Energy anom." value={m.energyAnomalies} tone="var(--bad)" />
        <HudStat label="Buildings" value={m.buildingsMonitored} />
        <HudStat label="Tasks" value={m.pendingMaintenance} />
        <HudStat label="Automations" value={m.automationRuns} tone="var(--cyan)" />
      </div>
    </HudPanel>
  );
}
