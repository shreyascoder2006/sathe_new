"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Workflow } from "lucide-react";
import { useApi, apiSend, refreshCampus } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { Card, Badge, Button, StatusDot, LoadingCard, ErrorState, severityTone, cx } from "@/components/ui";
import { AIExplanation } from "@/components/panels/AIExplanation";
import { fmtDate, fmtClock, timeAgo, titleCase } from "@/lib/format";
import { INCIDENT_STATUS } from "@/lib/constants";

interface Detail {
  id: string;
  code: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  source: string;
  summary: string;
  createdAt: string;
  resolvedAt: string | null;
  evidence: null | Record<string, string | number>;
  aiExplanation: null | {
    what: string;
    why: string;
    likelyCause: string;
    impact: string;
    recommendedAction: string;
    mode?: string;
  };
  building?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  tasks: { id: string; code: string; title: string; team: string; status: string; assignee?: { name: string } | null }[];
  notifications: { id: string; title: string; body: string; level: string; createdAt: string }[];
  execution: { id: string; trigger: string; status: string; steps: { action: string; status: string; detail: string }[]; rule: { name: string } } | null;
}
interface User {
  id: string;
  name: string;
  team: string | null;
}

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: inc, error, isLoading, mutate } = useApi<Detail>(`/api/incidents/${id}`, {
    refreshInterval: 15000,
  });
  const { data: users } = useApi<User[]>("/api/users");

  async function patch(body: Record<string, unknown>) {
    await apiSend(`/api/incidents/${id}`, "PATCH", body);
    await Promise.all([mutate(), refreshCampus()]);
  }
  async function taskStatus(taskId: string, status: string) {
    await apiSend(`/api/tasks/${taskId}`, "PATCH", { status });
    await Promise.all([mutate(), refreshCampus()]);
  }

  if (isLoading && !inc)
    return (
      <PageShell title="Incident" eyebrow="Operations">
        <LoadingCard lines={6} />
      </PageShell>
    );
  if (error || !inc)
    return (
      <PageShell title="Incident" eyebrow="Operations">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  return (
    <PageShell
      title={inc.title}
      eyebrow={`${inc.code} · ${titleCase(inc.type)}`}
      subtitle={inc.summary}
      actions={
        <Link href="/incidents" className="text-xs text-[var(--cyan)] hover:underline">
          <ArrowLeft className="mr-1 inline size-3.5" />
          All incidents
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {inc.evidence && (
            <Card className="p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                Evidence
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(inc.evidence).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-[var(--border)] bg-black/20 p-2.5">
                    <div className="text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
                      {titleCase(k)}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">{String(v)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {inc.aiExplanation && <AIExplanation data={inc.aiExplanation} />}

          {inc.execution && (
            <Card className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                <Workflow className="size-3.5" /> Automation execution — {inc.execution.rule.name}
              </h3>
              <ol className="space-y-1.5">
                {inc.execution.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[13px]">
                    <span
                      className="mt-1 size-1.5 shrink-0 rounded-full"
                      style={{
                        background:
                          s.status === "success" ? "var(--ok)" : s.status === "failed" ? "var(--bad)" : "var(--text-faint)",
                      }}
                    />
                    <span>
                      <span className="font-medium">{titleCase(s.action)}</span>
                      <span className="text-[var(--text-dim)]"> — {s.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Tasks ({inc.tasks.length})
            </h3>
            {inc.tasks.length === 0 ? (
              <p className="text-[13px] text-[var(--text-dim)]">No tasks linked.</p>
            ) : (
              <div className="space-y-1.5">
                {inc.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
                    <StatusDot status={t.status} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{t.title}</div>
                      <div className="text-[12px] text-[var(--text-faint)]">
                        {t.code} · {t.team} {t.assignee ? `· ${t.assignee.name}` : ""}
                      </div>
                    </div>
                    <select
                      value={t.status}
                      onChange={(e) => taskStatus(t.id, e.target.value)}
                      className="ml-auto rounded-md border border-[var(--border)] bg-[var(--bg-2)] px-1.5 py-1 text-[12px] capitalize"
                    >
                      {["assigned", "in_progress", "done"].map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {inc.notifications.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                Notifications sent
              </h3>
              <div className="space-y-1.5">
                {inc.notifications.map((n) => (
                  <div key={n.id} className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-[13px]">
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={n.level === "critical" ? "critical" : n.level === "warning" ? "attention" : "acknowledged"} />
                      <span className="font-medium">{n.title}</span>
                      <span className="ml-auto text-[12px] text-[var(--text-faint)]">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-[var(--text-dim)]">{n.body}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* side controls */}
        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
              <Badge tone="neutral" className="capitalize">
                {inc.source}
              </Badge>
            </div>
            <div className="mt-3 space-y-2 text-[13px]">
              <Row label="Opened" value={`${fmtDate(inc.createdAt)} ${fmtClock(inc.createdAt)}`} />
              {inc.resolvedAt && <Row label="Resolved" value={`${fmtDate(inc.resolvedAt)} ${fmtClock(inc.resolvedAt)}`} />}
              {inc.building && (
                <Row
                  label="Building"
                  value={
                    <Link href={`/buildings/${inc.building.id}`} className="text-[var(--cyan)] hover:underline">
                      {inc.building.name}
                    </Link>
                  }
                />
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Status
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {INCIDENT_STATUS.map((s) => (
                <button
                  key={s}
                  onClick={() => patch({ status: s })}
                  className={cx(
                    "rounded-lg border px-2 py-1.5 text-[13px] capitalize transition-colors",
                    inc.status === s
                      ? "border-[var(--cyan)]/40 bg-[var(--cyan)]/15 text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-strong)]",
                  )}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>

            <h3 className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Assignee
            </h3>
            <select
              value={inc.assignee?.id ?? ""}
              onChange={(e) => patch({ assigneeId: e.target.value || null })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs"
            >
              <option value="">Unassigned</option>
              {(users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.team ? `· ${u.team}` : ""}
                </option>
              ))}
            </select>

            <h3 className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Severity
            </h3>
            <div className="flex gap-1.5">
              {["low", "medium", "high", "critical"].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={inc.severity === s ? "primary" : "subtle"}
                  onClick={() => patch({ severity: s })}
                  className="flex-1 capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--text-faint)]">{label}</span>
      <span className="text-right text-[var(--text-dim)]">{value}</span>
    </div>
  );
}
