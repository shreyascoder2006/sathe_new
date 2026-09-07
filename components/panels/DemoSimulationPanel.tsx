"use client";

import { useState } from "react";
import { Zap, Users, Activity, Accessibility, Search, Clock, ShieldAlert, FlaskConical, ChevronRight, FastForward } from "lucide-react";
import { apiSend, refreshCampus } from "@/lib/client";
import { useCampus } from "@/lib/store";
import { Button, Badge, cx } from "@/components/ui";
import type { SimScenario } from "@/lib/constants";

const SCENARIOS: {
  id: SimScenario;
  label: string;
  icon: typeof Zap;
  desc: string;
  focus?: string;
}[] = [
  { id: "energy_anomaly", label: "Energy anomaly", icon: Zap, desc: "Spike grid draw in the Science Block", focus: "science-block" },
  { id: "crowd_surge", label: "Crowd surge", icon: Users, desc: "Push occupancy past capacity at the Main Building", focus: "main-building" },
  { id: "equipment_issue", label: "Equipment fault", icon: Activity, desc: "Abnormal vibration on the CNC machine", focus: "science-block" },
  { id: "lift_outage", label: "Lift outage", icon: Accessibility, desc: "Take the Science Block lift out of service", focus: "science-block" },
  { id: "queue_buildup", label: "Queue buildup", icon: Clock, desc: "25-min wait at the Examination Cell", focus: "admin-exam" },
  { id: "security_event", label: "Security event", icon: ShieldAlert, desc: "Off-hours activity near a restricted lab", focus: "science-block" },
  { id: "lost_item_match", label: "Lost-item match", icon: Search, desc: "AI matches a reported bag to a found item" },
];

export function DemoSimulationPanel({ compact }: { compact?: boolean }) {
  const [running, setRunning] = useState<string | null>(null);
  const [last, setLast] = useState<{ headline: string; ok: boolean } | null>(null);
  const select = useCampus((s) => s.select);
  const pushEvent = useCampus((s) => s.pushEvent);

  async function run(s: (typeof SCENARIOS)[number]) {
    setRunning(s.id);
    setLast(null);
    try {
      const res = await apiSend<{ headline: string; automation: { matched: boolean; ruleName?: string }[] }>(
        "/api/simulate",
        "POST",
        { scenario: s.id },
      );
      if (s.focus) select(s.focus);
      pushEvent(res.headline);
      setLast({ headline: res.headline, ok: true });
      await refreshCampus();
    } catch (e) {
      setLast({ headline: e instanceof Error ? e.message : "Simulation failed", ok: false });
    } finally {
      setRunning(null);
    }
  }

  async function tick() {
    setRunning("tick");
    try {
      await apiSend("/api/tick", "POST");
      await refreshCampus();
      setLast({ headline: "Campus clock advanced 30 minutes — fresh readings ingested.", ok: true });
    } catch {
      setLast({ headline: "Could not advance the clock", ok: false });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-1)]/70">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
        <FlaskConical className="size-4 text-[var(--cyan)]" />
        <span className="text-xs font-semibold">Demo simulation</span>
        <Badge tone="neutral" className="ml-auto">persists to DB</Badge>
      </div>

      <div className={cx("grid gap-1.5 p-2.5", compact ? "grid-cols-1" : "grid-cols-1")}>
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => run(s)}
              disabled={!!running}
              className="group flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/50 px-2.5 py-2 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-2)] disabled:opacity-50"
            >
              <Icon className="size-4 shrink-0 text-[var(--text-faint)] group-hover:text-[var(--cyan)]" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[var(--text)]">{s.label}</div>
                <div className="truncate text-[12px] text-[var(--text-dim)]">{s.desc}</div>
              </div>
              {running === s.id ? (
                <div className="size-3.5 animate-spin rounded-full border border-[var(--border)] border-t-[var(--cyan)]" />
              ) : (
                <ChevronRight className="size-3.5 text-[var(--text-faint)]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-[var(--border)] p-2.5">
        <Button variant="subtle" size="sm" className="w-full" onClick={tick} loading={running === "tick"}>
          <FastForward className="size-3.5" /> Advance campus time (+30 min)
        </Button>
        {last && (
          <p
            className={cx(
              "mt-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug",
              last.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300",
            )}
          >
            {last.headline}
          </p>
        )}
      </div>
    </div>
  );
}
