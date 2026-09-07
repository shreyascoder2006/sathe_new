import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && (
            <div className="mb-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--cyan)]">
              {eyebrow}
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-dim)]">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
