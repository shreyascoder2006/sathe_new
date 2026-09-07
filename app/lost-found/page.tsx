"use client";

import { useState } from "react";
import { Search, PackageSearch, Sparkles, Check, X } from "lucide-react";
import { useApi, apiSend } from "@/lib/client";
import { PageShell } from "@/components/ui/PageShell";
import { Card, Stat, Badge, Button, LoadingCard, ErrorState, EmptyState, cx } from "@/components/ui";
import { timeAgo, titleCase } from "@/lib/format";

const CATEGORIES = ["bottle", "electronics", "id_card", "keys", "clothing", "bag", "book", "other"];

interface Item {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  color: string | null;
  status: string;
  createdAt: string;
  reportedBy?: string;
  foundBy?: string;
}
interface Match {
  id: string;
  confidence: number;
  rationale: string;
  status: string;
  lostItem: Item;
  foundItem: Item;
}
interface Resp {
  lost: Item[];
  found: Item[];
  matches: Match[];
}

export default function LostFoundPage() {
  const { data, error, isLoading, mutate } = useApi<Resp>("/api/lost-found", {
    refreshInterval: 15000,
  });
  const [tab, setTab] = useState<"lost" | "found">("lost");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "bottle",
    location: "",
    color: "",
    reporter: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiSend<{ matches: number; bestConfidence: number }>(
        "/api/lost-found",
        "POST",
        { kind: tab, ...form },
      );
      setMsg(
        res.matches > 0
          ? `Logged. ${res.matches} candidate match(es) found — best ${Math.round(res.bestConfidence * 100)}% confidence.`
          : "Logged. No matches yet — you'll be notified if one appears.",
      );
      setForm({ title: "", description: "", category: "bottle", location: "", color: "", reporter: "" });
      await mutate();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  async function act(matchId: string, action: "confirm" | "reject" | "claim") {
    await apiSend("/api/lost-found/match", "POST", { matchId, action });
    await mutate();
  }

  if (isLoading && !data)
    return (
      <PageShell title="LostLoop" eyebrow="AI Lost & Found">
        <LoadingCard lines={4} />
      </PageShell>
    );
  if (error || !data)
    return (
      <PageShell title="LostLoop" eyebrow="AI Lost & Found">
        <ErrorState message={error?.message} retry={() => mutate()} />
      </PageShell>
    );

  const openMatches = data.matches.filter((m) => m.status === "suggested");

  return (
    <PageShell
      title="LostLoop"
      eyebrow="AI Lost & Found"
      subtitle="One place for lost and found reports. NEXUS matches items on description, category, location and time proximity, and tracks the claim through to return."
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Lost — open" value={data.lost.filter((i) => i.status === "open" || i.status === "matched").length} icon={<Search className="size-4" />} />
        <Stat label="Found — stored" value={data.found.filter((i) => i.status === "stored" || i.status === "matched").length} icon={<PackageSearch className="size-4" />} />
        <Stat label="Match suggestions" value={openMatches.length} accent="var(--violet)" icon={<Sparkles className="size-4" />} />
        <Stat label="Returned" value={data.found.filter((i) => i.status === "returned").length} accent="var(--ok)" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* report form */}
        <Card className="p-4">
          <div className="mb-3 flex gap-1 rounded-lg border border-[var(--border)] bg-black/20 p-1">
            {(["lost", "found"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cx(
                  "flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors",
                  tab === t ? "bg-[var(--blue)]/20 text-[var(--text)]" : "text-[var(--text-dim)]",
                )}
              >
                Report {t}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-2.5">
            <Field label="Title">
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="Black steel water bottle" />
            </Field>
            <Field label="Description">
              <textarea
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={cx(inputCls, "h-20 resize-none")}
                placeholder="Distinguishing marks, contents, stickers…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Category">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {titleCase(c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Colour">
                <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} placeholder="black" />
              </Field>
            </div>
            <Field label="Location">
              <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} placeholder="Central Library reading hall" />
            </Field>
            <Field label={tab === "lost" ? "Reported by" : "Found by"}>
              <input required value={form.reporter} onChange={(e) => setForm({ ...form, reporter: e.target.value })} className={inputCls} placeholder="Name / roll no." />
            </Field>
            <Button type="submit" variant="primary" loading={busy} className="w-full">
              Submit {tab} report
            </Button>
            {msg && (
              <p className="rounded-lg bg-[var(--violet)]/10 px-2.5 py-1.5 text-[13px] text-[var(--text-dim)]">
                {msg}
              </p>
            )}
          </form>
        </Card>

        {/* matches + galleries */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-[var(--violet)]" /> AI match suggestions
            </h3>
            {openMatches.length === 0 ? (
              <EmptyState title="No pending matches" hint="New reports are matched automatically against the opposite list." icon={<Sparkles className="size-6" />} />
            ) : (
              <div className="space-y-2">
                {openMatches.map((m) => (
                  <Card key={m.id} className="p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge tone="violet">{Math.round(m.confidence * 100)}% match</Badge>
                      <span className="text-[13px] text-[var(--text-dim)]">{m.rationale}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ItemMini item={m.lostItem} tag="LOST" />
                      <ItemMini item={m.foundItem} tag="FOUND" />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => act(m.id, "confirm")}>
                        <Check className="size-3.5" /> Confirm
                      </Button>
                      <Button size="sm" variant="subtle" onClick={() => act(m.id, "claim")}>
                        Mark returned
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => act(m.id, "reject")}>
                        <X className="size-3.5" /> Not a match
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Gallery title="Lost items" items={data.lost} />
            <Gallery title="Found items" items={data.found} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--blue)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ItemMini({ item, tag }: { item: Item; tag: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-white/10 px-1 text-[13px] font-bold text-[var(--text-dim)]">{tag}</span>
        <span className="truncate text-[13px] font-medium">{item.title}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[12px] text-[var(--text-dim)]">{item.description}</p>
      <p className="mt-1 text-[13px] text-[var(--text-faint)]">
        {item.location} · {timeAgo(item.createdAt)}
      </p>
    </div>
  );
}

function Gallery({ title, items }: { title: string; items: Item[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
        {title} ({items.length})
      </h4>
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-[13px] text-[var(--text-dim)]">Nothing here yet.</p>}
        {items.slice(0, 8).map((i) => (
          <div key={i.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-1)]/70 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium">{i.title}</span>
              <Badge
                tone={
                  i.status === "returned" || i.status === "claimed"
                    ? "ok"
                    : i.status === "matched"
                      ? "violet"
                      : "neutral"
                }
                className="ml-auto"
              >
                {i.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-[12px] text-[var(--text-faint)]">
              {titleCase(i.category)} · {i.location}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
