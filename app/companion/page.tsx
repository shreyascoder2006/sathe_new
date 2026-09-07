"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Clock,
  MapPin,
  Utensils,
  Search,
  Megaphone,
  Sparkles,
  Users,
  ChevronRight,
  Check,
} from "lucide-react";
import { useApi, apiSend } from "@/lib/client";
import { useRole } from "@/components/shell/RoleProvider";
import { PageShell } from "@/components/ui/PageShell";
import { Card, Button, Badge, Meter, LoadingCard, cx } from "@/components/ui";
import { fmtClock } from "@/lib/format";
import { CAMPUS_BUILDINGS } from "@/lib/geo/campus";

interface Slot {
  id: string;
  course: string;
  faculty: string;
  room: string;
  startHour: number;
  endHour: number;
  building: { id: string; name: string };
}
interface TT {
  identity: { kind: string; name: string };
  current: Slot | null;
  next: Slot | null;
  today: Slot[];
}
interface Occ {
  buildings: {
    id: string;
    name: string;
    shortName: string;
    count: number;
    capacity: number;
    occupancyPct: number;
    density: string;
  }[];
}
interface MenuItem {
  id: string;
  name: string;
  station: string;
  price: number;
}
interface Canteen {
  menu: MenuItem[];
  liveQueue: number;
  demandForecast: { at: string; predictedOrders: number; wait: number }[];
}

const hh = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "am" : "pm"}`;

export default function CompanionPage() {
  const { config } = useRole();
  const { data: tt } = useApi<TT>("/api/timetable", { refreshInterval: 30000 });
  const { data: occ } = useApi<Occ>("/api/occupancy", { refreshInterval: 15000 });
  const { data: canteen, mutate: mutateCanteen } = useApi<Canteen>("/api/canteen", {
    refreshInterval: 20000,
  });
  const [tab, setTab] = useState<"home" | "canteen" | "report">("home");

  const busy = useMemo(() => {
    const list = occ?.buildings ?? [];
    const lib = list.find((b) => b.id === "library");
    const cant = list.find((b) => b.id === "canteen");
    return { lib, cant };
  }, [occ]);

  return (
    <PageShell
      title={`Hi — you're signed in as a ${config.label}`}
      eyebrow="Campus Companion"
      subtitle="One place for your day on campus. Everything here is grounded in live campus data."
      actions={
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/50 p-1 text-sm">
          {(["home", "canteen", "report"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx(
                "rounded-md px-3 py-1.5 capitalize transition-colors",
                tab === t ? "bg-[var(--blue)]/20 text-[var(--text)]" : "text-[var(--text-dim)]",
              )}
            >
              {t === "report" ? "Report an issue" : t}
            </button>
          ))}
        </div>
      }
    >
      {tab === "home" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* class card */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cyan)]">
              <Clock className="size-4" /> Your timetable
            </div>
            {!tt ? (
              <div className="mt-3">
                <LoadingCard lines={2} />
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {tt.current ? (
                  <div className="rounded-xl border border-[var(--cyan)]/30 bg-[var(--cyan)]/8 p-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--text-faint)]">
                      Right now
                    </div>
                    <div className="mt-1 text-lg font-semibold">{tt.current.course}</div>
                    <div className="text-sm text-[var(--text-dim)]">
                      {tt.current.building.name} · {tt.current.room} · {tt.current.faculty} ·{" "}
                      {hh(tt.current.startHour)}–{hh(tt.current.endHour)}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-[var(--border)] bg-black/20 p-4 text-sm text-[var(--text-dim)]">
                    No class scheduled at this hour.
                  </p>
                )}
                {tt.next && (
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-black/20 p-4">
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-wider text-[var(--text-faint)]">
                        Next
                      </div>
                      <div className="mt-1 font-semibold">{tt.next.course}</div>
                      <div className="text-sm text-[var(--text-dim)]">
                        {tt.next.building.name} · {tt.next.room} · {hh(tt.next.startHour)}
                      </div>
                    </div>
                    <Link
                      href={`/buildings/${tt.next.building.id}`}
                      className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--cyan)] hover:border-[var(--border-strong)]"
                    >
                      <MapPin className="size-3.5" /> Navigate
                    </Link>
                  </div>
                )}
                {tt.today.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tt.today.map((s) => (
                      <span
                        key={s.id}
                        className={cx(
                          "rounded-md border px-2 py-1 text-xs",
                          s.id === tt.current?.id
                            ? "border-[var(--cyan)]/40 bg-[var(--cyan)]/10 text-[var(--text)]"
                            : "border-[var(--border)] text-[var(--text-dim)]",
                        )}
                      >
                        {hh(s.startHour)} · {s.course}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* campus pulse */}
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cyan)]">
              <Users className="size-4" /> Is it busy right now?
            </div>
            <div className="mt-3 space-y-3">
              {[busy.lib, busy.cant].filter(Boolean).map((b) => (
                <div key={b!.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{b!.name}</span>
                    <Badge
                      tone={
                        b!.density === "congested"
                          ? "bad"
                          : b!.density === "busy"
                            ? "warn"
                            : "ok"
                      }
                    >
                      {b!.density}
                    </Badge>
                  </div>
                  <Meter
                    value={b!.occupancyPct}
                    tone={
                      b!.occupancyPct >= 90
                        ? "var(--bad)"
                        : b!.occupancyPct >= 70
                          ? "var(--warn)"
                          : "var(--ok)"
                    }
                  />
                  <div className="mt-1 text-xs text-[var(--text-dim)]">
                    {b!.count} / {b!.capacity} people
                  </div>
                </div>
              ))}
              <Link
                href="/flow"
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                See the whole campus <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </Card>

          {/* quick actions */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-3 sm:grid-cols-3">
            <QuickAction icon={Sparkles} label="Ask NEXUS AI" hint="Use the button, bottom-right" />
            <QuickAction icon={Utensils} label="Order lunch ahead" onClick={() => setTab("canteen")} />
            <QuickAction icon={Megaphone} label="Report an issue" onClick={() => setTab("report")} />
            <QuickAction icon={Search} label="Lost & found" href="/lost-found" />
            <QuickAction icon={MapPin} label="Campus map" href="/command" />
            <QuickAction icon={Clock} label="Service queues" href="/queues" />
          </div>
        </div>
      )}

      {tab === "canteen" && <CanteenPanel canteen={canteen} onOrdered={() => mutateCanteen()} />}
      {tab === "report" && <ReportPanel />}
    </PageShell>
  );
}

function QuickAction({
  icon: Icon,
  label,
  hint,
  href,
  onClick,
}: {
  icon: typeof Clock;
  label: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-1)]/70 p-4 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-2)]/70">
      <Icon className="size-5 text-[var(--cyan)]" />
      <div className="text-sm font-medium">{label}</div>
      {hint && <div className="text-xs text-[var(--text-dim)]">{hint}</div>}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return (
    <button onClick={onClick} className="text-left">
      {inner}
    </button>
  );
}

function CanteenPanel({
  canteen,
  onOrdered,
}: {
  canteen?: Canteen;
  onOrdered: () => void;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [pickup, setPickup] = useState(30);
  const [name, setName] = useState("");
  const [placed, setPlaced] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canteen) return <LoadingCard lines={4} />;

  const total = Object.entries(cart).reduce((s, [id, qty]) => {
    const m = canteen.menu.find((x) => x.id === id);
    return s + (m ? m.price * qty : 0);
  }, 0);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  async function order() {
    setBusy(true);
    try {
      const res = await apiSend<{ code: string }>("/api/canteen", "POST", {
        items: Object.entries(cart).map(([menuItemId, qty]) => ({ menuItemId, qty })),
        pickupInMinutes: pickup,
        placedBy: name || "Student",
      });
      setPlaced(res.code);
      setCart({});
      onOrdered();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Menu — order ahead</h3>
          <Badge tone={canteen.liveQueue > 10 ? "warn" : "ok"}>
            live queue: {canteen.liveQueue}
          </Badge>
        </div>
        <div className="mt-3 space-y-4">
          {["Counter 1", "Counter 2", "Beverages"].map((station) => (
            <div key={station}>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                {station}
              </div>
              <div className="space-y-1.5">
                {canteen.menu
                  .filter((m) => m.station === station)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2"
                    >
                      <span className="flex-1 text-sm">{m.name}</span>
                      <span className="text-sm text-[var(--text-dim)]">₹{m.price}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            setCart((c) => {
                              const n = Math.max(0, (c[m.id] ?? 0) - 1);
                              const { [m.id]: _, ...rest } = c;
                              return n === 0 ? rest : { ...c, [m.id]: n };
                            })
                          }
                          className="size-6 rounded border border-[var(--border)] text-sm"
                        >
                          −
                        </button>
                        <span className="w-4 text-center text-sm tabular-nums">{cart[m.id] ?? 0}</span>
                        <button
                          onClick={() =>
                            setCart((c) => ({ ...c, [m.id]: Math.min(5, (c[m.id] ?? 0) + 1) }))
                          }
                          className="size-6 rounded border border-[var(--border)] text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        <Card className="p-4">
          <h3 className="text-sm font-semibold">Your order</h3>
          <div className="mt-2 space-y-1 text-sm text-[var(--text-dim)]">
            {count === 0 && <p>Nothing added yet.</p>}
            {Object.entries(cart).map(([id, qty]) => {
              const m = canteen.menu.find((x) => x.id === id);
              return m ? (
                <div key={id} className="flex justify-between">
                  <span>
                    {qty}× {m.name}
                  </span>
                  <span>₹{m.price * qty}</span>
                </div>
              ) : null;
            })}
          </div>
          {count > 0 && (
            <>
              <div className="mt-2 flex justify-between border-t border-[var(--border)] pt-2 text-sm font-semibold">
                <span>Total</span>
                <span>₹{total}</span>
              </div>
              <label className="mt-3 block text-xs text-[var(--text-dim)]">
                Pick up in
                <select
                  value={pickup}
                  onChange={(e) => setPickup(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-sm"
                >
                  {[15, 30, 45, 60].map((n) => (
                    <option key={n} value={n}>
                      {n} minutes
                    </option>
                  ))}
                </select>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name / roll no."
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-sm"
              />
              <Button variant="primary" className="mt-2 w-full" loading={busy} onClick={order}>
                Place order · ₹{total}
              </Button>
            </>
          )}
          {placed && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300">
              <Check className="size-3.5" /> Order {placed} received — you&apos;ll be told when it&apos;s ready.
            </p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold">Demand forecast</h3>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            Pre-orders + the queue model tell the kitchen what&apos;s coming.
          </p>
          <div className="mt-2 space-y-1.5">
            {canteen.demandForecast.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-[var(--text-dim)]">{w.at}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-white/8">
                  <div
                    className="h-full rounded bg-[var(--cyan)]"
                    style={{ width: `${Math.min(100, w.predictedOrders / 2)}%` }}
                  />
                </div>
                <span className="w-20 text-right text-[var(--text-faint)]">~{w.wait} min wait</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReportPanel() {
  const [form, setForm] = useState({
    category: "equipment",
    buildingId: "",
    location: "",
    description: "",
    reporter: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiSend<{ incident: { code: string } }>("/api/report", "POST", form);
      setDone(res.incident.code);
      setForm({ category: "equipment", buildingId: "", location: "", description: "", reporter: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-xl p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cyan)]">
        <Megaphone className="size-4" /> Report a campus issue
      </div>
      <p className="mt-1 text-sm text-[var(--text-dim)]">
        The digital twin identifies the building automatically and routes it to the right team.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-[var(--text-dim)]">
            Type
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-2 text-sm"
            >
              {["equipment", "accessibility", "energy", "security", "occupancy", "queue"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--text-dim)]">
            Building
            <select
              value={form.buildingId}
              onChange={(e) => setForm({ ...form, buildingId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-2 text-sm"
            >
              <option value="">Not sure</option>
              {CAMPUS_BUILDINGS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.shortName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs text-[var(--text-dim)]">
          Where exactly
          <input
            required
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. 2nd floor corridor, near lift B"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-[var(--text-dim)]">
          What&apos;s wrong
          <textarea
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 h-24 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-[var(--text-dim)]">
          Your name / roll no.
          <input
            required
            value={form.reporter}
            onChange={(e) => setForm({ ...form, reporter: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-2 text-sm"
          />
        </label>
        <Button type="submit" variant="primary" loading={busy} className="w-full">
          Submit report
        </Button>
        {done && (
          <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-300">
            <Check className="size-3.5" /> Logged as {done}. You can track it — an administrator has been notified.
          </p>
        )}
      </form>
    </Card>
  );
}
