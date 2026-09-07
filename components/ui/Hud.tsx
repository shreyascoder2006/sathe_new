"use client";

import type { ReactNode } from "react";
import { cx } from "./index";

export function HudPanel({
  title,
  titleEn,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  titleEn?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("hud-panel", className)}>
      <span className="hud-corner left-0 top-0 border-b-0 border-r-0" />
      <span className="hud-corner right-0 top-0 border-b-0 border-l-0" />
      <span className="hud-corner bottom-0 left-0 border-r-0 border-t-0" />
      <span className="hud-corner bottom-0 right-0 border-l-0 border-t-0" />
      <header className="flex items-center gap-2 px-3.5 pt-3">
        <span className="h-3 w-0.5 bg-[var(--cyan)]" />
        <h3 className="hud-heading">{title}</h3>
        {titleEn && (
          <span className="text-[13px] uppercase tracking-widest text-[var(--text-faint)]">
            {titleEn}
          </span>
        )}
        {right && <div className="ml-auto">{right}</div>}
      </header>
      <div className={cx("px-3.5 pb-3.5 pt-2.5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function HudStat({
  label,
  value,
  unit,
  tone = "var(--cyan)",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-black/30 px-2.5 py-2">
      <div className="text-[13px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums" style={{ color: tone }}>
          {value}
        </span>
        {unit && <span className="text-[12px] text-[var(--text-dim)]">{unit}</span>}
      </div>
    </div>
  );
}
