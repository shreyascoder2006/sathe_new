"use client";

import { Clock, Users2, CalendarClock } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { Card, Stat, Badge, Sparkline, LoadingCard, ErrorState } from "@/components/ui";

interface Svc {
  id: string;
  name: string;
  category: string;
  description: string;
  buildingName: string;
  queueLength: number;
  waitMinutes: number;
  status: string;
  predictedPeak: { label: string; wait: number };
  recommendedWindow: { label: string; wait: number } | null;
  series: { at: string; wait: number; queue: number }[];
}
interface Resp {
  anomalies: { headline: string; severity: string }[];
  services: Svc[];
}

export default function QueuesPage() {
  const { data, error, isLoading, mutate } = useApi<Resp>("/api/services", {
    refreshInterval: 12000,
  });

  if (isLoading && !data)
    return (
      <PageShell title="QueueLess" eyebrow="Service Queue Intelligence">
        <div className="grid gap-3 sm:grid-cols-2">
          <LoadingCard />
          <LoadingCard />
        </div>
      </PageShell>
    );
  if (error || !data)
    return (
      <PageShell title="QueueLess" eyebrow="Service Queue Intelligence">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  const busiest = data.services.slice().sort((a, b) => b.waitMinutes - a.waitMinutes);
  const avg = Math.round(
    data.services.reduce((s, x) => s + x.waitMinutes, 0) / Math.max(data.services.length, 1),
  );

  return (
    <PageShell
      title="QueueLess"
      eyebrow="Service Queue Intelligence"
      subtitle="Live queue length and estimated wait for campus service counters, predicted peak windows, and a recommended off-peak visiting time. Queue length is CCTV-derived (simulated)."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Service points" value={data.services.length} icon={<Users2 className="size-4" />} />
        <Stat label="Avg wait now" value={`${avg} min`} accent={avg >= 18 ? "var(--warn)" : "var(--ok)"} icon={<Clock className="size-4" />} />
        <Stat
          label="Counters flagged"
          value={data.anomalies.length}
          accent={data.anomalies.length ? "var(--bad)" : "var(--ok)"}
          icon={<CalendarClock className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {busiest.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <p className="text-[13px] text-[var(--text-dim)]">
                  {s.buildingName} · {s.category}
                </p>
              </div>
              <Badge tone={s.status === "busy" ? "warn" : s.status === "closed" ? "neutral" : "ok"}>
                {s.status}
              </Badge>
            </div>

            <div className="mt-3 flex items-end gap-4">
              <div>
                <div className="text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
                  Est. wait
                </div>
                <div
                  className="text-2xl font-semibold tabular-nums"
                  style={{ color: s.waitMinutes >= 25 ? "var(--bad)" : s.waitMinutes >= 15 ? "var(--warn)" : "var(--ok)" }}
                >
                  {s.waitMinutes}
                  <span className="text-sm font-normal text-[var(--text-dim)]"> min</span>
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
                  In queue
                </div>
                <div className="text-2xl font-semibold tabular-nums">{s.queueLength}</div>
              </div>
              <div className="ml-auto w-28">
                <Sparkline data={s.series.map((r) => r.wait)} height={34} />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-2.5 py-2 text-amber-200">
                Predicted peak {s.predictedPeak.label} · ~{s.predictedPeak.wait} min
              </div>
              {s.recommendedWindow && (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-2 text-emerald-200">
                  Best visit {s.recommendedWindow.label} · ~{s.recommendedWindow.wait} min
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
