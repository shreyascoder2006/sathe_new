"use client";

import { ShieldAlert, ShieldCheck, Radio } from "lucide-react";
import { useApi, apiSend, refreshCampus } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { Card, Stat, Badge, Button, StatusDot, LoadingCard, ErrorState, EmptyState, severityTone } from "@/components/ui";
import { timeAgo } from "@/lib/format";

interface Incident {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  createdAt: string;
  resolvedAt: string | null;
  building?: { name: string } | null;
  tasks: { id: string; code: string; team: string; status: string }[];
}

export default function SecurityPage() {
  const { data, error, isLoading, mutate } = useApi<Incident[]>("/api/incidents?type=security", {
    refreshInterval: 12000,
  });

  async function setStatus(id: string, status: string) {
    await apiSend(`/api/incidents/${id}`, "PATCH", { status });
    await Promise.all([mutate(), refreshCampus()]);
  }

  if (isLoading && !data)
    return (
      <PageShell title="CampusShield" eyebrow="Security & Incident Response">
        <LoadingCard lines={3} />
      </PageShell>
    );
  if (error || !data)
    return (
      <PageShell title="CampusShield" eyebrow="Security & Incident Response">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  const open = data.filter((i) => i.status !== "resolved");
  const resolved = data.filter((i) => i.status === "resolved");

  return (
    <PageShell
      title="CampusShield"
      eyebrow="Security & Incident Response"
      subtitle="Restricted-area and off-hours activity monitoring, incident severity and the security response timeline. This module is simulation-based — there is no live surveillance integration in the prototype."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open security incidents" value={open.length} accent={open.length ? "var(--bad)" : "var(--ok)"} icon={<ShieldAlert className="size-4" />} />
        <Stat label="Resolved" value={resolved.length} accent="var(--ok)" icon={<ShieldCheck className="size-4" />} />
        <Stat label="Monitoring mode" value="Simulated" hint="prerecorded / event-driven" icon={<Radio className="size-4" />} />
      </div>

      <div className="mt-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-dim)]">Active incidents</h3>
        {open.length === 0 ? (
          <EmptyState
            title="No active security incidents"
            hint="Trigger the 'Security event' demo scenario from the Command Center to see the response workflow."
            icon={<ShieldCheck className="size-6" />}
          />
        ) : (
          open.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={severityTone(i.severity)}>{i.severity}</Badge>
                <span className="text-sm font-semibold">{i.title}</span>
                <span className="text-[13px] text-[var(--text-faint)]">
                  {i.code} · {i.building?.name ?? "campus"} · {timeAgo(i.createdAt)}
                </span>
                <Badge tone="info" className="ml-auto capitalize">
                  {i.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-dim)]">{i.summary}</p>

              <div className="mt-3 rounded-lg border border-[var(--border)] bg-black/20 p-3">
                <div className="mb-1.5 text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
                  Response timeline
                </div>
                <ol className="space-y-1.5 text-[13px]">
                  <li className="flex gap-2">
                    <StatusDot status="critical" />
                    Detected · {timeAgo(i.createdAt)} — restricted-zone / off-hours activity flagged
                  </li>
                  {i.tasks.map((t) => (
                    <li key={t.id} className="flex gap-2">
                      <StatusDot status={t.status} />
                      {t.code} dispatched to {t.team} — {t.status.replace("_", " ")}
                    </li>
                  ))}
                  <li className="flex gap-2">
                    <StatusDot status={i.status} />
                    Administrator notified · escalation {i.status === "open" ? "pending acknowledgement" : "acknowledged"}
                  </li>
                </ol>
              </div>

              <div className="mt-3 flex gap-2">
                {i.status === "open" && (
                  <Button size="sm" variant="subtle" onClick={() => setStatus(i.id, "acknowledged")}>
                    Acknowledge
                  </Button>
                )}
                {i.status !== "in_progress" && i.status !== "resolved" && (
                  <Button size="sm" variant="subtle" onClick={() => setStatus(i.id, "in_progress")}>
                    Mark in progress
                  </Button>
                )}
                <Button size="sm" variant="primary" onClick={() => setStatus(i.id, "resolved")}>
                  Resolve
                </Button>
              </div>
            </Card>
          ))
        )}

        {resolved.length > 0 && (
          <>
            <h3 className="pt-2 text-sm font-semibold text-[var(--text-dim)]">Incident history</h3>
            {resolved.map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-1)]/60 px-3 py-2 text-[13px]"
              >
                <StatusDot status="resolved" />
                <span className="font-medium">{i.title}</span>
                <span className="text-[var(--text-faint)]">{i.code}</span>
                <span className="ml-auto text-[var(--text-faint)]">
                  resolved {i.resolvedAt ? timeAgo(i.resolvedAt) : ""}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </PageShell>
  );
}
