"use client";

import Link from "next/link";
import { useApi } from "@/lib/client";
import { fmtKwh, fmtPct } from "@/lib/format";
import {
  Badge,
  Meter,
  Sparkline,
  StatusDot,
  Skeleton,
  severityTone,
  cx,
} from "@/components/ui";
import { AIExplanation } from "./AIExplanation";
import {
  Zap,
  Users,
  Activity,
  Accessibility,
  ArrowUpRight,
  TriangleAlert,
} from "lucide-react";

interface Detail {
  building: {
    id: string;
    name: string;
    shortName: string;
    category: string;
    description: string;
    floors: number;
    approxNote: string;
    healthScore: number;
    status: string;
    liftStatus: string;
    equipment: { id: string; name: string; healthScore: number; status: string; failureRisk: number }[];
    incidents: {
      id: string;
      code: string;
      title: string;
      severity: string;
      status: string;
      summary: string;
      aiExplanation: null | {
        what: string;
        why: string;
        likelyCause: string;
        impact: string;
        recommendedAction: string;
        mode?: string;
      };
    }[];
    accessRoutes: { id: string; label: string; stepFree: boolean; available: boolean }[];
  };
  live?: {
    energyKwh: number;
    energyBaseline: number;
    energyDeviationPct: number;
    occupancy: number;
    capacity: number;
    occupancyPct: number;
    openIncidents: number;
  };
  series: {
    energy: { at: string; kwh: number; baseline: number }[];
    occupancy: { at: string; count: number; baseline: number; capacity: number }[];
  };
}

const SERVICE_LINKS = [
  { href: "/energy", label: "Energy", icon: Zap },
  { href: "/flow", label: "Occupancy", icon: Users },
  { href: "/labs", label: "Maintenance", icon: Activity },
  { href: "/accessibility", label: "Access", icon: Accessibility },
];

export function BuildingIntelPanel({ buildingId }: { buildingId: string }) {
  const { data, isLoading, error } = useApi<Detail>(`/api/buildings/${buildingId}`, {
    refreshInterval: 15000,
  });

  if (isLoading && !data)
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (error || !data)
    return <p className="text-xs text-[var(--bad)]">Could not load building intelligence.</p>;

  const { building: b, live, series } = data;
  const topIncident = b.incidents.find((i) => i.status !== "resolved" && i.aiExplanation);

  return (
    <div className="space-y-3.5">
      <div>
        <div className="flex items-center gap-2">
          <StatusDot status={b.status} pulse={b.status !== "nominal"} />
          <h3 className="text-base font-semibold text-[var(--text)]">{b.name}</h3>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">{b.description}</p>
        <p className="mt-1 text-[12px] italic text-[var(--text-faint)]">{b.approxNote}</p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
              Building health
            </span>
            <span className="text-sm font-semibold tabular-nums">{b.healthScore}%</span>
          </div>
          <div className="mt-1.5">
            <Meter
              value={b.healthScore}
              tone={b.healthScore >= 82 ? "var(--ok)" : b.healthScore >= 65 ? "var(--warn)" : "var(--bad)"}
            />
          </div>
        </div>
      </div>

      {/* service navigation */}
      <div className="grid grid-cols-4 gap-1.5">
        {SERVICE_LINKS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/50 py-2 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            >
              <Icon className="size-3.5 text-[var(--cyan)]" />
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* live metrics */}
      {live && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2.5">
            <div className="flex items-center gap-1 text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
              <Zap className="size-3" /> Energy now
            </div>
            <div className="mt-1 text-sm font-semibold">{fmtKwh(live.energyKwh)}</div>
            <div
              className={cx(
                "text-[12px]",
                live.energyDeviationPct >= 12 ? "text-[var(--warn)]" : "text-[var(--text-dim)]",
              )}
            >
              {fmtPct(live.energyDeviationPct)} vs baseline
            </div>
            <div className="mt-1.5">
              <Sparkline
                data={series.energy.slice(-40).map((r) => r.kwh)}
                baseline={series.energy.slice(-40).map((r) => r.baseline)}
                height={28}
              />
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2.5">
            <div className="flex items-center gap-1 text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
              <Users className="size-3" /> Occupancy
            </div>
            <div className="mt-1 text-sm font-semibold">
              {live.occupancy}
              <span className="text-[12px] font-normal text-[var(--text-dim)]"> / {live.capacity}</span>
            </div>
            <div className="text-[12px] text-[var(--text-dim)]">{live.occupancyPct}% of capacity</div>
            <div className="mt-1.5">
              <Sparkline
                data={series.occupancy.slice(-40).map((r) => r.count)}
                baseline={series.occupancy.slice(-40).map((r) => r.baseline)}
                stroke="var(--blue)"
                fill="rgba(59,130,246,0.12)"
                height={28}
              />
            </div>
          </div>
        </div>
      )}

      {/* incidents */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          <TriangleAlert className="size-3" /> Active incidents ({b.incidents.filter((i) => i.status !== "resolved").length})
        </div>
        {b.incidents.filter((i) => i.status !== "resolved").length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text-dim)]">
            No open incidents for this building.
          </p>
        ) : (
          <div className="space-y-1.5">
            {b.incidents
              .filter((i) => i.status !== "resolved")
              .map((i) => (
                <Link
                  key={i.id}
                  href={`/incidents/${i.id}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/40 px-2.5 py-2 hover:border-[var(--border-strong)]"
                >
                  <div className="flex items-center gap-1.5">
                    <Badge tone={severityTone(i.severity)}>{i.severity}</Badge>
                    <span className="text-[13px] font-medium">{i.title}</span>
                    <ArrowUpRight className="ml-auto size-3 text-[var(--text-faint)]" />
                  </div>
                </Link>
              ))}
          </div>
        )}
      </div>

      {topIncident?.aiExplanation && <AIExplanation data={topIncident.aiExplanation} />}

      {/* equipment */}
      {b.equipment.length > 0 && (
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Equipment ({b.equipment.length})
          </div>
          <div className="space-y-1">
            {b.equipment.slice(0, 4).map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-black/20 px-2.5 py-1.5"
              >
                <StatusDot status={e.status} />
                <span className="truncate text-[13px]">{e.name}</span>
                <span className="ml-auto text-[12px] tabular-nums text-[var(--text-dim)]">
                  {e.healthScore}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* accessibility */}
      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          Accessibility · lift {b.liftStatus.replace(/_/g, " ")}
        </div>
        <div className="space-y-1">
          {b.accessRoutes.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-[13px]">
              <StatusDot status={r.available ? "operational" : "out_of_service"} />
              <span className={cx(!r.available && "line-through opacity-60")}>{r.label}</span>
              {r.stepFree && <Badge tone="ok">step-free</Badge>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
