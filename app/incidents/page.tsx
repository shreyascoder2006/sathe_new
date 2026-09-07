"use client";

import { useState } from "react";
import Link from "next/link";
import { TriangleAlert, Filter } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { Card, Badge, StatusDot, LoadingCard, ErrorState, EmptyState, severityTone, cx } from "@/components/ui";
import { timeAgo, titleCase } from "@/lib/format";
import { INCIDENT_STATUS } from "@/lib/constants";

interface Incident {
  id: string;
  code: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  source: string;
  createdAt: string;
  building?: { name: string } | null;
  assignee?: { name: string } | null;
  tasks: { id: string }[];
  execution: { id: string } | null;
}

export default function IncidentsPage() {
  const { data, error, isLoading, mutate } = useApi<Incident[]>("/api/incidents", {
    refreshInterval: 12000,
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  if (isLoading && !data)
    return (
      <PageShell title="Incident Management" eyebrow="Operations">
        <LoadingCard lines={6} />
      </PageShell>
    );
  if (error || !data)
    return (
      <PageShell title="Incident Management" eyebrow="Operations">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  const types = Array.from(new Set(data.map((i) => i.type)));
  const filtered = data.filter(
    (i) =>
      (statusFilter === "all" || i.status === statusFilter) &&
      (typeFilter === "all" || i.type === typeFilter),
  );
  const openCount = data.filter((i) => i.status !== "resolved").length;

  return (
    <PageShell
      title="Incident Management"
      eyebrow="Operations"
      subtitle={`${data.length} incidents on record · ${openCount} open. Every incident links to its evidence, AI analysis, automation execution and assigned tasks.`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="size-3.5 text-[var(--text-faint)]" />
        <Chips
          value={statusFilter}
          onChange={setStatusFilter}
          options={["all", ...INCIDENT_STATUS]}
        />
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <Chips value={typeFilter} onChange={setTypeFilter} options={["all", ...types]} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No incidents match these filters" icon={<TriangleAlert className="size-6" />} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-2)]/60 text-[12px] uppercase tracking-wider text-[var(--text-faint)]">
              <tr>
                <th className="px-3 py-2 font-medium">Incident</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Building</th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Assignee</th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell">Automation</th>
                <th className="px-3 py-2 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  className="border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-2)]/40"
                >
                  <td className="px-3 py-2.5">
                    <Link href={`/incidents/${i.id}`} className="block">
                      <div className="font-medium text-[var(--text)]">{i.title}</div>
                      <div className="text-[12px] text-[var(--text-faint)]">
                        {i.code} · {titleCase(i.type)} · {i.source}
                      </div>
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 text-[var(--text-dim)] sm:table-cell">
                    {i.building?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={severityTone(i.severity)}>{i.severity}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot status={i.status} />
                      <span className="capitalize text-[var(--text-dim)]">
                        {i.status.replace("_", " ")}
                      </span>
                    </span>
                  </td>
                  <td className="hidden px-3 py-2.5 text-[var(--text-dim)] md:table-cell">
                    {i.assignee?.name ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    {i.execution ? <Badge tone="violet">auto</Badge> : <span className="text-[var(--text-faint)]">manual</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-faint)]">{timeAgo(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

function Chips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cx(
            "rounded-md px-2 py-1 text-[13px] capitalize transition-colors",
            value === o
              ? "bg-[var(--blue)]/20 text-[var(--text)]"
              : "text-[var(--text-dim)] hover:bg-white/5",
          )}
        >
          {o.replace("_", " ")}
        </button>
      ))}
    </div>
  );
}
