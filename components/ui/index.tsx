"use client";

import Link from "next/link";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Card / Panel ---------------- */
export function Card({
  children,
  className,
  interactive,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-xl bg-[var(--bg-1)]/80 hairline",
        interactive && "transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-2)]/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  right,
  sub,
}: {
  children: ReactNode;
  right?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-[var(--text)]">{children}</h2>
        {sub && <p className="mt-0.5 text-xs text-[var(--text-dim)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------------- Button ---------------- */
export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  loading,
  className,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  const variants: Record<string, string> = {
    default:
      "bg-[var(--bg-3)] text-[var(--text)] hover:bg-[var(--bg-3)]/70 border border-[var(--border)]",
    primary:
      "bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] text-white hover:from-[#3b82f6] hover:to-[#2563eb] border border-[#3b82f6]/40 shadow-[0_1px_0_rgba(255,255,255,0.1)_inset]",
    ghost: "bg-transparent text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-white/5",
    subtle: "bg-white/5 text-[var(--text)] hover:bg-white/10 border border-[var(--border)]",
    danger: "bg-[#7f1d1d]/40 text-[#fecaca] hover:bg-[#7f1d1d]/60 border border-[#f87171]/30",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------------- Status ---------------- */
const STATUS_COLOR: Record<string, string> = {
  nominal: "var(--ok)",
  operational: "var(--ok)",
  healthy: "var(--ok)",
  open: "var(--warn)",
  attention: "var(--warn)",
  monitor: "var(--warn)",
  busy: "var(--warn)",
  degraded: "var(--warn)",
  acknowledged: "var(--blue)",
  in_progress: "var(--blue)",
  critical: "var(--bad)",
  at_risk: "var(--bad)",
  out_of_service: "var(--bad)",
  offline: "var(--bad)",
  resolved: "var(--text-faint)",
  done: "var(--text-faint)",
  closed: "var(--text-faint)",
};

export function statusColor(s: string) {
  return STATUS_COLOR[s] ?? "var(--text-dim)";
}

export function StatusDot({ status, pulse }: { status: string; pulse?: boolean }) {
  const c = statusColor(status);
  return (
    <span className="relative inline-flex size-2">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: c }}
        />
      )}
      <span className="relative inline-flex size-2 rounded-full" style={{ background: c }} />
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "info" | "violet";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/5 text-[var(--text-dim)] border-white/10",
    ok: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    bad: "bg-red-500/10 text-red-300 border-red-500/25",
    info: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[13px] font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const severityTone = (s: string) =>
  s === "critical" ? "bad" : s === "high" ? "bad" : s === "medium" ? "warn" : "info";

/* ---------------- Stat ---------------- */
export function Stat({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-faint)]">
          {label}
        </span>
        {icon && <span className="text-[var(--text-faint)]">{icon}</span>}
      </div>
      <div
        className="mt-2 text-2xl font-semibold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--text-dim)]">{hint}</div>}
    </Card>
  );
}

/* ---------------- Progress ---------------- */
export function Meter({ value, tone = "var(--blue)" }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }}
      />
    </div>
  );
}

/* ---------------- Sparkline ---------------- */
export function Sparkline({
  data,
  stroke = "var(--cyan)",
  fill = "rgba(34,211,238,0.12)",
  height = 40,
  baseline,
}: {
  data: number[];
  stroke?: string;
  fill?: string;
  height?: number;
  baseline?: number[];
}) {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const all = baseline ? [...data, ...baseline] : data;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const w = 100;
  const pt = (arr: number[]) =>
    arr
      .map((v, i) => `${(i / (arr.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`)
      .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polygon points={`0,${height} ${pt(data)} ${w},${height}`} fill={fill} />
      {baseline && (
        <polyline
          points={pt(baseline)}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={pt(data)}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ---------------- States ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-lg", className)} />;
}

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="space-y-3 p-4">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </Card>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-1)]/40 px-6 py-12 text-center">
      <div className="mb-3 text-[var(--text-faint)]">{icon ?? <Inbox className="size-6" />}</div>
      <p className="text-sm font-medium text-[var(--text)]">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-[var(--text-dim)]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message?: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-6 text-red-400" />
      <p className="text-sm font-medium text-[var(--text)]">Something went wrong</p>
      <p className="mt-1 max-w-sm text-xs text-[var(--text-dim)]">
        {message ?? "Could not load this data."}
      </p>
      {retry && (
        <Button variant="subtle" size="sm" className="mt-4" onClick={retry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export { Link };
