"use client";

import { Users, Route, AlertTriangle } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { TrendChart } from "@/components/ui/Chart";
import { Card, Stat, Badge, Meter, LoadingCard, ErrorState, cx } from "@/components/ui";

interface FlowBuilding {
  id: string;
  name: string;
  shortName: string;
  color: string;
  count: number;
  capacity: number;
  occupancyPct: number;
  baseline: number;
  density: string;
  predictedCongestion: { label: string; load: number; people: number }[];
  alternateRoute: string | null;
  series: { at: string; count: number; baseline: number }[];
}
interface FlowResp {
  campusPeople: number;
  congestionZones: string[];
  anomalies: { headline: string; severity: string }[];
  buildings: FlowBuilding[];
}

const densityTone: Record<string, "ok" | "warn" | "bad" | "info"> = {
  light: "info",
  moderate: "info",
  busy: "warn",
  congested: "bad",
};

export default function FlowPage() {
  const { data, error, isLoading, mutate } = useApi<FlowResp>("/api/occupancy", {
    refreshInterval: 12000,
  });

  if (isLoading && !data)
    return (
      <PageShell title="CampusFlow" eyebrow="Crowd & Campus Flow">
        <div className="grid gap-3 sm:grid-cols-3">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </PageShell>
    );
  if (error || !data)
    return (
      <PageShell title="CampusFlow" eyebrow="Crowd & Campus Flow">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  const sorted = data.buildings.slice().sort((a, b) => b.occupancyPct - a.occupancyPct);

  return (
    <PageShell
      title="CampusFlow"
      eyebrow="Crowd & Campus Flow"
      subtitle="Occupancy by building and zone, crowd density, predicted congestion windows from the historical hourly curve, and alternate-route recommendations. Occupancy is CCTV-derived (simulated for the prototype)."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="People on campus" value={data.campusPeople} icon={<Users className="size-4" />} />
        <Stat
          label="Congestion zones"
          value={data.congestionZones.length}
          accent={data.congestionZones.length ? "var(--bad)" : "var(--ok)"}
          icon={<AlertTriangle className="size-4" />}
        />
        <Stat
          label="Predicted surges (next 4h)"
          value={data.buildings.reduce((s, b) => s + b.predictedCongestion.length, 0)}
          icon={<Route className="size-4" />}
        />
      </div>

      {data.anomalies.length > 0 && (
        <div className="mt-4 space-y-1 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
          {data.anomalies.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
              <Badge tone={a.severity === "high" || a.severity === "critical" ? "bad" : "warn"}>
                {a.severity}
              </Badge>
              {a.headline}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {sorted.map((b) => (
          <Card key={b.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">{b.name}</h3>
                <p className="text-[13px] text-[var(--text-dim)]">
                  {b.count} / {b.capacity} · expected {b.baseline}
                </p>
              </div>
              <Badge tone={densityTone[b.density]}>{b.density}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-xl font-semibold tabular-nums">{b.occupancyPct}%</span>
              <div className="flex-1">
                <Meter
                  value={b.occupancyPct}
                  tone={
                    b.occupancyPct >= 90
                      ? "var(--bad)"
                      : b.occupancyPct >= 70
                        ? "var(--warn)"
                        : "var(--blue)"
                  }
                />
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-black/20 p-2">
              <TrendChart
                data={b.series.map((r) => ({ at: r.at, value: r.count, baseline: r.baseline }))}
                color={b.color}
                unit=""
                label="headcount"
                height={130}
              />
            </div>
            {b.predictedCongestion.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.predictedCongestion.map((p, i) => (
                  <span
                    key={i}
                    className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[12px] text-amber-300"
                  >
                    ~{p.people} people ~{p.label} ({p.load}%)
                  </span>
                ))}
              </div>
            )}
            {b.alternateRoute && (
              <div
                className={cx(
                  "mt-2 flex gap-2 rounded-lg border border-[var(--cyan)]/25 bg-[var(--cyan)]/8 p-2.5 text-[13px] text-[var(--text-dim)]",
                )}
              >
                <Route className="mt-0.5 size-3.5 shrink-0 text-[var(--cyan)]" />
                {b.alternateRoute}
              </div>
            )}
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
