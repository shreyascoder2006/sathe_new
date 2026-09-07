"use client";

import { useState } from "react";
import { Zap, TrendingUp, AlertTriangle, IndianRupee } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { TrendChart } from "@/components/ui/Chart";
import {
  Card,
  Stat,
  Meter,
  Badge,
  Sparkline,
  LoadingCard,
  ErrorState,
  cx,
} from "@/components/ui";
import { fmtKwh, fmtRupees, fmtPct } from "@/lib/format";

interface EnergyBuilding {
  id: string;
  name: string;
  shortName: string;
  color: string;
  currentKwh: number;
  baselineKwh: number;
  deviationPct: number;
  todayKwh: number;
  wasteKwh: number;
  wasteRupees: number;
  energyHealth: number;
  forecastPeakKwh: number | null;
  forecastPeakAt: string | null;
  recommendation: string;
  series: { at: string; kwh: number; baseline: number }[];
}
interface EnergyResp {
  campusTodayKwh: number;
  campusWasteKwh: number;
  campusWasteRupees: number;
  energyHealth: number;
  anomalies: { buildingId?: string; headline: string; severity: string; deviationPct: number }[];
  buildings: EnergyBuilding[];
}

export default function EnergyPage() {
  const { data, error, isLoading, mutate } = useApi<EnergyResp>("/api/energy", {
    refreshInterval: 15000,
  });
  const [sel, setSel] = useState<string | null>(null);

  if (isLoading && !data)
    return (
      <PageShell title="EnergyMind" eyebrow="Energy Intelligence">
        <div className="grid gap-3 sm:grid-cols-3">
          <LoadingCard /> <LoadingCard /> <LoadingCard />
        </div>
      </PageShell>
    );
  if (error || !data)
    return (
      <PageShell title="EnergyMind" eyebrow="Energy Intelligence">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  const selected = data.buildings.find((b) => b.id === sel) ?? data.buildings[0];

  return (
    <PageShell
      title="EnergyMind"
      eyebrow="Energy Intelligence"
      subtitle="Building-wise consumption vs historical baseline, anomaly detection, estimated wastage and recommended action. Readings are simulated at hourly resolution and persisted."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Campus draw today" value={fmtKwh(data.campusTodayKwh)} icon={<Zap className="size-4" />} />
        <Stat
          label="Energy health"
          value={`${data.energyHealth}%`}
          accent={data.energyHealth >= 80 ? "var(--ok)" : "var(--warn)"}
          icon={<TrendingUp className="size-4" />}
        />
        <Stat
          label="Estimated wastage"
          value={fmtKwh(data.campusWasteKwh)}
          hint="above 105% of baseline, last 24h"
          accent="var(--warn)"
          icon={<AlertTriangle className="size-4" />}
        />
        <Stat
          label="Avoidable cost"
          value={fmtRupees(data.campusWasteRupees)}
          hint="≈ ₹9.5 / kWh commercial tariff"
          accent="var(--bad)"
          icon={<IndianRupee className="size-4" />}
        />
      </div>

      {data.anomalies.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="size-4" /> {data.anomalies.length} active energy anomaly
            {data.anomalies.length > 1 ? "ies" : ""}
          </div>
          <div className="space-y-1">
            {data.anomalies.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
                <Badge tone={a.severity === "critical" || a.severity === "high" ? "bad" : "warn"}>
                  {fmtPct(a.deviationPct)}
                </Badge>
                {a.headline}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* building list */}
        <div className="space-y-2">
          {data.buildings
            .slice()
            .sort((a, b) => b.deviationPct - a.deviationPct)
            .map((b) => (
              <button
                key={b.id}
                onClick={() => setSel(b.id)}
                className={cx(
                  "w-full rounded-xl border bg-[var(--bg-1)]/70 p-3 text-left transition-colors",
                  selected.id === b.id
                    ? "border-[var(--cyan)]/40 bg-[var(--bg-2)]/70"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{b.shortName}</span>
                  <Badge
                    tone={b.deviationPct >= 25 ? "bad" : b.deviationPct >= 12 ? "warn" : "ok"}
                  >
                    {fmtPct(b.deviationPct)}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between text-[13px] text-[var(--text-dim)]">
                  <span>{fmtKwh(b.currentKwh)} now</span>
                  <span>health {b.energyHealth}%</span>
                </div>
                <div className="mt-1.5">
                  <Sparkline
                    data={b.series.slice(-40).map((r) => r.kwh)}
                    baseline={b.series.slice(-40).map((r) => r.baseline)}
                    stroke={b.color}
                    height={26}
                  />
                </div>
              </button>
            ))}
        </div>

        {/* detail */}
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">{selected.name}</h3>
              <p className="text-xs text-[var(--text-dim)]">
                {fmtKwh(selected.currentKwh)} now · expected {fmtKwh(selected.baselineKwh)} ·{" "}
                {fmtKwh(selected.todayKwh)} today
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--text-faint)]">Energy health</div>
              <div className="text-lg font-semibold">{selected.energyHealth}%</div>
            </div>
          </div>
          <div className="mt-2">
            <Meter
              value={selected.energyHealth}
              tone={selected.energyHealth >= 80 ? "var(--ok)" : "var(--warn)"}
            />
          </div>

          <div className="mt-4 rounded-lg border border-[var(--border)] bg-black/20 p-3">
            <TrendChart
              data={selected.series.map((r) => ({ at: r.at, value: r.kwh, baseline: r.baseline }))}
              color={selected.color}
              unit=" kWh"
              label="draw"
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
              <div className="text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
                Estimated wastage (24h)
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--warn)]">
                {fmtKwh(selected.wasteKwh)} · {fmtRupees(selected.wasteRupees)}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
              <div className="text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
                Deviation
              </div>
              <div className="mt-1 text-sm font-semibold">{fmtPct(selected.deviationPct)} vs baseline</div>
            </div>
            <div className="rounded-lg border border-[var(--cyan)]/25 bg-[var(--cyan)]/8 p-3">
              <div className="text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
                Forecast peak (24h)
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--cyan)]">
                {selected.forecastPeakKwh ? `${fmtKwh(selected.forecastPeakKwh)} @ ${selected.forecastPeakAt}` : "—"}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-[var(--violet)]/25 bg-[var(--violet)]/8 p-3 text-xs leading-relaxed text-[var(--text-dim)]">
            <span className="font-semibold text-[var(--violet)]">Recommendation · </span>
            {selected.recommendation}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
