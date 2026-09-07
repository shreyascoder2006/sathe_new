"use client";

import { Sparkles, HelpCircle, Search, TrendingDown, Wrench } from "lucide-react";
import { Badge } from "@/components/ui";

export interface ExplanationShape {
  what: string;
  why: string;
  likelyCause: string;
  impact: string;
  recommendedAction: string;
  mode?: string;
}

export function llmLabel(mode?: string) {
  if (!mode || mode === "rule-based") return "rule-based";
  return { groq: "Groq · Llama 3.3", gemini: "Gemini", claude: "Claude" }[mode] ?? mode;
}

const ROWS = [
  { key: "what", label: "What happened", icon: HelpCircle },
  { key: "why", label: "Why it's unusual", icon: Search },
  { key: "likelyCause", label: "Likely cause", icon: Sparkles },
  { key: "impact", label: "Predicted impact", icon: TrendingDown },
  { key: "recommendedAction", label: "Recommended action", icon: Wrench },
] as const;

export function AIExplanation({ data }: { data: ExplanationShape }) {
  return (
    <div className="rounded-xl border border-[var(--violet)]/25 bg-gradient-to-b from-[var(--violet)]/8 to-transparent p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-[var(--violet)]" />
        <span className="text-xs font-semibold">NEXUS AI analysis</span>
        <Badge tone={data.mode && data.mode !== "rule-based" ? "violet" : "neutral"} className="ml-auto">
          {llmLabel(data.mode)}
        </Badge>
      </div>
      <div className="space-y-2.5">
        {ROWS.map((r) => {
          const Icon = r.icon;
          const val = data[r.key];
          if (!val) return null;
          return (
            <div key={r.key} className="flex gap-2.5">
              <Icon className="mt-0.5 size-3.5 shrink-0 text-[var(--text-faint)]" />
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                  {r.label}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-dim)]">{val}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
