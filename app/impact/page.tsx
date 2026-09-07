"use client";

import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Timer, IndianRupee, ShieldCheck } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { Card, Stat, LoadingCard, ErrorState } from "@/components/ui";
import { fmtRupees, fmtNumber, titleCase } from "@/lib/format";

interface Impact {
  issuesDetected: number;
  issuesResolved: number;
  avgResponseMin: number;
  energyAnomalies: number;
  maintenanceTasks: number;
  automationRuns: number;
  minutesSaved: number;
  rupeesSaved: number;
  flaggedEnergyKwh: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

const TYPE_COLOR: Record<string, string> = {
  energy: "#22d3ee",
  occupancy: "#3b82f6",
  equipment: "#8b5cf6",
  security: "#f87171",
  accessibility: "#2dd4bf",
  queue: "#f59e0b",
};

export default function ImpactPage() {
  const { data, error, isLoading, mutate } = useApi<Impact>("/api/impact", {
    refreshInterval: 15000,
  });

  if (isLoading && !data)
    return (
      <PageShell title="Impact Dashboard" eyebrow="Operations">
        <div className="grid gap-3 sm:grid-cols-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </PageShell>
    );
  if (error || !data)
    return (
      <PageShell title="Impact Dashboard" eyebrow="Operations">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  const resolutionRate = data.issuesDetected
    ? Math.round((data.issuesResolved / data.issuesDetected) * 100)
    : 0;

  return (
    <PageShell
      title="Impact Dashboard"
      eyebrow="Operations"
      subtitle="Campus-wide outcomes aggregated from stored records — what NEXUS detected, what got resolved, and the time and cost the automation loop is estimated to have saved."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Issues detected" value={data.issuesDetected} icon={<TrendingUp className="size-4" />} />
        <Stat
          label="Issues resolved"
          value={`${data.issuesResolved}`}
          hint={`${resolutionRate}% resolution rate`}
          accent="var(--ok)"
          icon={<ShieldCheck className="size-4" />}
        />
        <Stat label="Avg response time" value={`${data.avgResponseMin} min`} icon={<Timer className="size-4" />} />
        <Stat label="Automation runs" value={data.automationRuns} accent="var(--cyan)" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Energy anomalies flagged" value={data.energyAnomalies} />
        <Stat label="Maintenance tasks completed" value={data.maintenanceTasks} />
        <Stat
          label="Staff-time saved (est.)"
          value={`${fmtNumber(Math.round(data.minutesSaved / 60))} hr`}
          hint={`${fmtNumber(data.minutesSaved)} min of manual triage avoided`}
          icon={<Timer className="size-4" />}
        />
        <Stat
          label="Estimated value (est.)"
          value={fmtRupees(data.rupeesSaved)}
          hint="staff time + partial energy recovery"
          accent="var(--ok)"
          icon={<IndianRupee className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Incidents by type</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byType} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="type"
                tickFormatter={titleCase}
                tick={{ fill: "#67707f", fontSize: 10 }}
                stroke="rgba(255,255,255,0.1)"
              />
              <YAxis allowDecimals={false} tick={{ fill: "#67707f", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" />
              <Tooltip
                contentStyle={{ background: "#10131a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 12 }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.byType.map((t) => (
                  <Cell key={t.type} fill={TYPE_COLOR[t.type] ?? "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Incidents by status</h3>
          <div className="space-y-2">
            {data.byStatus.map((s) => {
              const pct = data.issuesDetected ? (s.count / data.issuesDetected) * 100 : 0;
              return (
                <div key={s.status}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="capitalize text-[var(--text-dim)]">{s.status.replace("_", " ")}</span>
                    <span className="tabular-nums">{s.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          s.status === "resolved"
                            ? "var(--ok)"
                            : s.status === "in_progress"
                              ? "var(--blue)"
                              : s.status === "acknowledged"
                                ? "var(--cyan)"
                                : "var(--warn)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-black/20 p-3 text-[13px] leading-relaxed text-[var(--text-dim)]">
            The loop NEXUS closes: a simulated/real signal is detected, explained with evidence,
            turned into an incident, routed to the right team automatically, and its outcome
            recorded here — {fmtNumber(data.flaggedEnergyKwh)} kWh of over-baseline energy has been
            flagged for recovery in the last 7 days.
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
