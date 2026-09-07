"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, X, CornerDownLeft } from "lucide-react";
import { apiSend } from "@/lib/client";
import { Button, cx } from "@/components/ui";

interface Msg {
  role: "user" | "nexus";
  text: string;
  sources?: { label: string; href?: string }[];
  mode?: string;
}

const SUGGESTIONS = [
  "Which buildings need attention?",
  "What are the active incidents?",
  "Which lab equipment needs maintenance?",
  "What happened in the last hour?",
];

export function NexusAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "nexus",
      text: "I'm NEXUS AI. I answer from live campus data — buildings, incidents, energy, equipment, queues and recent activity. Ask me anything.",
    },
  ]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    try {
      const res = await apiSend<{ answer: string; sources: Msg["sources"]; mode: string }>(
        "/api/assistant",
        "POST",
        { question },
      );
      setMsgs((m) => [
        ...m,
        { role: "nexus", text: res.answer, sources: res.sources, mode: res.mode },
      ]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: "nexus", text: e instanceof Error ? e.message : "Something went wrong." },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      );
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-gradient-to-br from-[var(--blue)] to-[var(--violet)] px-4 py-3 text-sm font-semibold text-white shadow-xl transition-transform hover:scale-105",
          open && "scale-0 opacity-0",
        )}
      >
        <Sparkles className="size-4" />
        NEXUS AI
      </button>

      <div
        className={cx(
          "fixed bottom-5 right-5 z-50 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-1)] shadow-2xl transition-all",
          open ? "h-[min(70vh,560px)] opacity-100" : "pointer-events-none h-0 opacity-0",
        )}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-gradient-to-r from-[var(--blue)]/15 to-[var(--violet)]/15 px-4 py-3">
          <Sparkles className="size-4 text-[var(--cyan)]" />
          <span className="text-sm font-semibold">NEXUS AI</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-[var(--text-dim)]">
            grounded in live data
          </span>
          <button onClick={() => setOpen(false)} className="ml-auto text-[var(--text-dim)] hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
          {msgs.map((m, i) => (
            <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cx(
                  "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed",
                  m.role === "user"
                    ? "bg-[var(--blue)] text-white"
                    : "border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text)]",
                )}
              >
                {m.text}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.sources.map((s, j) =>
                      s.href ? (
                        <Link
                          key={j}
                          href={s.href}
                          onClick={() => setOpen(false)}
                          className="rounded bg-white/8 px-1.5 py-0.5 text-[12px] text-[var(--cyan)] hover:bg-white/12"
                        >
                          {s.label}
                        </Link>
                      ) : (
                        <span key={j} className="rounded bg-white/8 px-1.5 py-0.5 text-[12px] text-[var(--text-dim)]">
                          {s.label}
                        </span>
                      ),
                    )}
                  </div>
                )}
                {m.mode && (
                  <div className="mt-1 text-[13px] uppercase tracking-wider text-[var(--text-faint)]">
                    {m.mode && m.mode !== "rule-based"
                      ? { groq: "Groq", gemini: "Gemini", claude: "Claude" }[m.mode] ?? m.mode
                      : "rule-based"}{" "}
                    response
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-xs text-[var(--text-dim)]">
                Reading campus data…
              </div>
            </div>
          )}
          {msgs.length <= 1 && (
            <div className="space-y-1.5 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/50 px-2.5 py-2 text-left text-[13px] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="flex items-center gap-2 border-t border-[var(--border)] p-2.5"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about the campus…"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-xs outline-none focus:border-[var(--blue)]"
          />
          <Button type="submit" size="sm" variant="primary" loading={busy}>
            <CornerDownLeft className="size-3.5" />
          </Button>
        </form>
      </div>
    </>
  );
}
