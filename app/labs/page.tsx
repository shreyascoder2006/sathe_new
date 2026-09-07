"use client";

import { useState } from "react";
import { Activity, Wrench, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useApi, apiSend, refreshCampus } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { TrendChart } from "@/components/ui/Chart";
import {
  Card,
  Stat,
  Badge,
  Meter,
  Button,
  StatusDot,
  LoadingCard,
  ErrorState,
  cx,
} from "@/components/ui";
import { fmtDate } from "@/lib/format";

interface Equip {
  id: string;
  name: string;
  assetTag: string;
  category: string;
  location: string;
  metric: string;
  healthScore: number;
  failureRisk: number;
  status: string;
  installedOn: string;
  lastServicedAt: string | null;
  predictedServiceAt: string | null;
  predictedDays: number | null;
  building: { name: string };
  tasks: { id: string; code: string; title: string; status: string; team: string }[];
  sensorReadings: { at: string; value: number; baseline: number }[];
}
interface Resp {
  anomalies: { equipmentId?: string; headline: string; severity: string }[];
  equipment: Equip[];
}

const METRIC_UNIT: Record<string, string> = {
  vibration_mm_s: " mm/s",
  temperature_c: " °C",
  current_a: " A",
};

export default function LabsPage() {
  const { data, error, isLoading, mutate } = useApi<Resp>("/api/equipment", {
    refreshInterval: 15000,
  });
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading && !data)
    return (
      <PageShell title="LabPulse" eyebrow="Predictive Maintenance">
        <div className="grid gap-3 sm:grid-cols-3">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </PageShell>
    );
  if (error || !data)
    return (
      <PageShell title="LabPulse" eyebrow="Predictive Maintenance">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  const selected = data.equipment.find((e) => e.id === sel) ?? data.equipment[0];
  const atRisk = data.equipment.filter((e) => e.status === "at_risk").length;
  const openTasks = data.equipment.reduce(
    (s, e) => s + e.tasks.filter((t) => t.status !== "done").length,
    0,
  );

  async function createTask() {
    if (!selected) return;
    setBusy(true);
    try {
      await apiSend("/api/equipment", "POST", { equipmentId: selected.id });
      await Promise.all([mutate(), refreshCampus()]);
    } finally {
      setBusy(false);
    }
  }
  async function completeTask(id: string) {
    await apiSend(`/api/tasks/${id}`, "PATCH", { status: "done" });
    await Promise.all([mutate(), refreshCampus()]);
  }

  return (
    <PageShell
      title="LabPulse"
      eyebrow="Predictive Maintenance"
      subtitle="Laboratory equipment health, live sensor trends, failure-risk scoring and predicted service dates. Sensor readings are simulated with ageing drift and persisted every 30 minutes of campus time."
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Assets tracked" value={data.equipment.length} icon={<Activity className="size-4" />} />
        <Stat label="At risk" value={atRisk} accent={atRisk ? "var(--bad)" : "var(--ok)"} icon={<ShieldAlert className="size-4" />} />
        <Stat label="Open maintenance tasks" value={openTasks} icon={<Wrench className="size-4" />} />
        <Stat
          label="Avg health"
          value={`${Math.round(data.equipment.reduce((s, e) => s + e.healthScore, 0) / data.equipment.length)}%`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-2">
          {data.equipment.map((e) => (
            <button
              key={e.id}
              onClick={() => setSel(e.id)}
              className={cx(
                "w-full rounded-xl border bg-[var(--bg-1)]/70 p-3 text-left transition-colors",
                selected?.id === e.id
                  ? "border-[var(--cyan)]/40 bg-[var(--bg-2)]/70"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]",
              )}
            >
              <div className="flex items-center gap-2">
                <StatusDot status={e.status} pulse={e.status === "at_risk"} />
                <span className="truncate text-sm font-medium">{e.name}</span>
                <span className="ml-auto text-[13px] tabular-nums text-[var(--text-dim)]">
                  {e.healthScore}%
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[12px] text-[var(--text-faint)]">
                <span>{e.building.name}</span>
                <span>risk {Math.round(e.failureRisk * 100)}%</span>
              </div>
              <div className="mt-1.5">
                <Meter
                  value={e.healthScore}
                  tone={e.healthScore >= 80 ? "var(--ok)" : e.healthScore >= 65 ? "var(--warn)" : "var(--bad)"}
                />
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">{selected.name}</h3>
                <p className="text-xs text-[var(--text-dim)]">
                  {selected.assetTag} · {selected.category} · {selected.location}
                </p>
              </div>
              <Badge tone={selected.status === "at_risk" ? "bad" : selected.status === "monitor" ? "warn" : "ok"}>
                {selected.status.replace("_", " ")}
              </Badge>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <MiniStat label="Health" value={`${selected.healthScore}%`} />
              <MiniStat label="Failure risk" value={`${Math.round(selected.failureRisk * 100)}%`} />
              <MiniStat
                label="Predicted service"
                value={
                  selected.predictedDays != null
                    ? selected.predictedDays <= 0
                      ? "overdue"
                      : `~${selected.predictedDays} d`
                    : "—"
                }
              />
            </div>

            <div className="mt-3 rounded-lg border border-[var(--border)] bg-black/20 p-3">
              <div className="mb-1 text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
                {selected.metric.replace(/_/g, " ")} — live vs healthy baseline
              </div>
              <TrendChart
                data={selected.sensorReadings.map((r) => ({
                  at: r.at,
                  value: r.value,
                  baseline: r.baseline,
                }))}
                color={selected.status === "at_risk" ? "#f87171" : "#22d3ee"}
                unit={METRIC_UNIT[selected.metric] ?? ""}
                label="reading"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-[13px] text-[var(--text-dim)]">
              <span>Installed {fmtDate(selected.installedOn)}</span>
              {selected.lastServicedAt && <span>· Last serviced {fmtDate(selected.lastServicedAt)}</span>}
            </div>

            {(selected.status === "at_risk" || selected.failureRisk > 0.3) && (
              <div className="mt-3 rounded-lg border border-[var(--violet)]/25 bg-[var(--violet)]/8 p-3 text-xs leading-relaxed text-[var(--text-dim)]">
                <span className="font-semibold text-[var(--violet)]">Prediction · </span>
                {selected.name}&apos;s {selected.metric.replace(/_/g, " ")} trend is drifting above the
                healthy band. Recommend inspection before the next scheduled practical; de-rate the
                asset if the reading climbs a further 15%.
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-dim)]">
                Maintenance tasks ({selected.tasks.length})
              </span>
              <Button size="sm" variant="primary" onClick={createTask} loading={busy}>
                <Wrench className="size-3.5" /> Raise task
              </Button>
            </div>
            <div className="mt-2 space-y-1.5">
              {selected.tasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text-dim)]">
                  No maintenance tasks for this asset.
                </p>
              )}
              {selected.tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2"
                >
                  <StatusDot status={t.status} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{t.title}</div>
                    <div className="text-[12px] text-[var(--text-faint)]">
                      {t.code} · {t.team}
                    </div>
                  </div>
                  {t.status !== "done" && (
                    <Button size="sm" variant="subtle" className="ml-auto" onClick={() => completeTask(t.id)}>
                      <CheckCircle2 className="size-3.5" /> Done
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2.5">
      <div className="text-[12px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
