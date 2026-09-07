"use client";

import { useState } from "react";
import { Workflow, Zap, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { useApi, apiSend, refreshCampus } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { Card, Stat, Badge, StatusDot, LoadingCard, ErrorState, cx } from "@/components/ui";
import { timeAgo, titleCase } from "@/lib/format";

interface Rule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  enabled: boolean;
  actions: { type: string; params?: Record<string, unknown> }[];
  _count: { executions: number };
}
interface Step {
  action: string;
  status: string;
  detail: string;
  at: string;
}
interface Execution {
  id: string;
  trigger: string;
  status: string;
  steps: Step[];
  createdAt: string;
  rule: { name: string };
  incident: {
    id: string;
    code: string;
    title: string;
    severity: string;
    building?: { name: string } | null;
    tasks: { code: string; team: string; status: string }[];
    notifications: { title: string }[];
  } | null;
}

export default function AutomationPage() {
  const rulesApi = useApi<Rule[]>("/api/automation/rules", { refreshInterval: 20000 });
  const execApi = useApi<Execution[]>("/api/automation/executions?limit=20", {
    refreshInterval: 12000,
  });
  const [openExec, setOpenExec] = useState<string | null>(null);

  async function toggle(rule: Rule) {
    await apiSend(`/api/automation/rules/${rule.id}`, "PATCH", { enabled: !rule.enabled });
    await Promise.all([rulesApi.mutate(), refreshCampus()]);
  }

  if ((rulesApi.isLoading && !rulesApi.data) || (execApi.isLoading && !execApi.data))
    return (
      <PageShell title="Automation Center" eyebrow="Operations">
        <LoadingCard lines={5} />
      </PageShell>
    );
  if (rulesApi.error || !rulesApi.data)
    return (
      <PageShell title="Automation Center" eyebrow="Operations">
        <ErrorState message={rulesApi.error?.message} retry={() => rulesApi.mutate()} />
      </PageShell>
    );

  const rules = rulesApi.data;
  const executions = execApi.data ?? [];
  const failedActions = executions
    .flatMap((e) => e.steps)
    .filter((s) => s.status === "failed").length;

  return (
    <PageShell
      title="Automation Center"
      eyebrow="Operations"
      subtitle="Every rule that lets NEXUS act on its own, and a full execution trace for each run — what was detected, the incident it opened, the task it assigned and the notifications it sent."
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Active rules" value={rules.filter((r) => r.enabled).length} icon={<Workflow className="size-4" />} />
        <Stat label="Total executions" value={executions.length ? rules.reduce((s, r) => s + r._count.executions, 0) : 0} icon={<Zap className="size-4" />} />
        <Stat label="Failed actions" value={failedActions} accent={failedActions ? "var(--bad)" : "var(--ok)"} icon={<XCircle className="size-4" />} />
        <Stat label="Tasks assigned" value={executions.reduce((s, e) => s + (e.incident?.tasks.length ?? 0), 0)} icon={<CheckCircle2 className="size-4" />} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* rules */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-dim)]">Automation rules</h3>
          <div className="space-y-2">
            {rules.map((r) => (
              <Card key={r.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggle(r)}
                    className={cx(
                      "mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors",
                      r.enabled ? "border-[var(--cyan)]/50 bg-[var(--cyan)]/30" : "border-[var(--border)] bg-black/40",
                    )}
                  >
                    <span
                      className={cx(
                        "block size-4 rounded-full bg-white transition-transform",
                        r.enabled ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.name}</span>
                      <Badge tone={r.enabled ? "ok" : "neutral"}>{r.enabled ? "on" : "off"}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-dim)]">
                      {r.description}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge tone="info">trigger: {titleCase(r.trigger)}</Badge>
                      {r.actions.map((a, i) => (
                        <Badge key={i} tone="neutral">
                          {titleCase(a.type)}
                        </Badge>
                      ))}
                      <span className="text-[12px] text-[var(--text-faint)]">
                        · {r._count.executions} runs
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* executions */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-dim)]">Recent executions</h3>
          {executions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-dim)]">
              No automation has run yet. Trigger a demo scenario from the Command Center.
            </div>
          ) : (
            <div className="space-y-2">
              {executions.map((e) => (
                <Card key={e.id} className="overflow-hidden">
                  <button
                    onClick={() => setOpenExec(openExec === e.id ? null : e.id)}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
                  >
                    <StatusDot status={e.status === "success" ? "nominal" : e.status === "failed" ? "critical" : "attention"} />
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-medium">{e.rule.name}</div>
                      <div className="text-[12px] text-[var(--text-faint)]">
                        {e.incident?.code ?? "—"} · {timeAgo(e.createdAt)} · {e.steps.length} steps
                      </div>
                    </div>
                    <ChevronDown
                      className={cx(
                        "ml-auto size-4 text-[var(--text-faint)] transition-transform",
                        openExec === e.id && "rotate-180",
                      )}
                    />
                  </button>
                  {openExec === e.id && (
                    <div className="border-t border-[var(--border)] bg-black/20 px-3.5 py-3">
                      <ol className="space-y-2">
                        {e.steps.map((s, i) => (
                          <li key={i} className="flex gap-2 text-[13px]">
                            <span
                              className="mt-1 size-1.5 shrink-0 rounded-full"
                              style={{
                                background:
                                  s.status === "success"
                                    ? "var(--ok)"
                                    : s.status === "failed"
                                      ? "var(--bad)"
                                      : "var(--text-faint)",
                              }}
                            />
                            <div>
                              <span className="font-medium text-[var(--text)]">{titleCase(s.action)}</span>
                              <span className="text-[var(--text-dim)]"> — {s.detail}</span>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {e.incident && (
                        <div className="mt-3 rounded-lg border border-[var(--border)] bg-black/30 p-2.5 text-[13px]">
                          <div className="font-medium">{e.incident.title}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {e.incident.tasks.map((t) => (
                              <Badge key={t.code} tone="info">
                                {t.code} → {t.team}
                              </Badge>
                            ))}
                            {e.incident.notifications.map((n, i) => (
                              <Badge key={i} tone="violet">
                                notified
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
