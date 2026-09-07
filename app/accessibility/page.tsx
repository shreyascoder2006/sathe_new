"use client";

import { Accessibility, ArrowRightLeft, DoorOpen } from "lucide-react";
import { useApi, apiSend, refreshCampus } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { Card, Stat, Badge, Button, StatusDot, LoadingCard, ErrorState, cx } from "@/components/ui";
import { timeAgo } from "@/lib/format";

interface B {
  id: string;
  name: string;
  shortName: string;
  liftStatus: string;
  status: string;
  stepFreeAvailable: boolean;
  routes: { id: string; label: string; entrance: string; stepFree: boolean; available: boolean; note: string | null }[];
}
interface Obstacle {
  id: string;
  code: string;
  title: string;
  status: string;
  severity: string;
  createdAt: string;
  building?: { name: string } | null;
}
interface Resp {
  buildings: B[];
  obstacles: Obstacle[];
}

export default function AccessibilityPage() {
  const { data, error, isLoading, mutate } = useApi<Resp>("/api/accessibility", {
    refreshInterval: 15000,
  });

  async function post(buildingId: string, action: "report_lift_outage" | "restore") {
    await apiSend("/api/accessibility", "POST", { buildingId, action });
    await Promise.all([mutate(), refreshCampus()]);
  }

  if (isLoading && !data)
    return (
      <PageShell title="CampusCare" eyebrow="Accessibility Monitoring">
        <LoadingCard lines={4} />
      </PageShell>
    );
  if (error || !data)
    return (
      <PageShell title="CampusCare" eyebrow="Accessibility Monitoring">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  const liftsDown = data.buildings.filter((b) => b.liftStatus === "out_of_service").length;
  const blocked = data.buildings.filter((b) => !b.stepFreeAvailable).length;

  return (
    <PageShell
      title="CampusCare"
      eyebrow="Accessibility Monitoring"
      subtitle="Lift status, accessible entrances and step-free routes per building, obstacle reports, and automatic alternate-route recommendations when access is disrupted."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Lifts out of service" value={liftsDown} accent={liftsDown ? "var(--bad)" : "var(--ok)"} icon={<ArrowRightLeft className="size-4" />} />
        <Stat label="Buildings without step-free access" value={blocked} accent={blocked ? "var(--warn)" : "var(--ok)"} icon={<DoorOpen className="size-4" />} />
        <Stat label="Open accessibility incidents" value={data.obstacles.filter((o) => o.status !== "resolved").length} icon={<Accessibility className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {data.buildings.map((b) => (
          <Card key={b.id} className="p-4">
            <div className="flex items-center gap-2">
              <StatusDot status={b.stepFreeAvailable ? "operational" : "out_of_service"} pulse={!b.stepFreeAvailable} />
              <h3 className="text-sm font-semibold">{b.name}</h3>
              <Badge
                tone={b.liftStatus === "operational" ? "ok" : b.liftStatus === "none" ? "neutral" : "bad"}
                className="ml-auto"
              >
                lift: {b.liftStatus.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="mt-2 space-y-1">
              {b.routes.map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-[13px]">
                  <StatusDot status={r.available ? "operational" : "out_of_service"} />
                  <div>
                    <span className={cx(!r.available && "line-through opacity-60")}>
                      {r.entrance}
                    </span>{" "}
                    {r.stepFree ? (
                      <Badge tone="ok">step-free</Badge>
                    ) : (
                      <Badge tone="warn">steps</Badge>
                    )}
                    {r.note && !r.available && (
                      <p className="mt-0.5 text-[12px] text-[var(--cyan)]">↳ {r.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              {b.liftStatus === "operational" ? (
                <Button size="sm" variant="subtle" onClick={() => post(b.id, "report_lift_outage")}>
                  Report lift outage
                </Button>
              ) : b.liftStatus !== "none" ? (
                <Button size="sm" variant="primary" onClick={() => post(b.id, "restore")}>
                  Restore access
                </Button>
              ) : (
                <span className="text-[12px] text-[var(--text-faint)]">Single-storey — no lift</span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {data.obstacles.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-dim)]">Accessibility incident log</h3>
          <div className="space-y-1.5">
            {data.obstacles.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-1)]/60 px-3 py-2 text-[13px]"
              >
                <StatusDot status={o.status} />
                <span className="font-medium">{o.title}</span>
                <span className="text-[var(--text-faint)]">
                  {o.code} · {o.building?.name} · {timeAgo(o.createdAt)}
                </span>
                <Badge tone={o.status === "resolved" ? "ok" : "warn"} className="ml-auto capitalize">
                  {o.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
