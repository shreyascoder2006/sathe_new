"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Maximize2, Zap, Users, Accessibility, Layers, RotateCcw, Sun, Moon, ScanLine } from "lucide-react";
import { useApi } from "@/lib/client";
import { useCampus } from "@/lib/store";
import { CampusFallback } from "./CampusFallback";
import type { BuildingLive } from "./types";
import { cx } from "@/components/ui";

const CampusScene = dynamic(() => import("./CampusScene").then((m) => m.CampusScene), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cyan)]" />
        <p className="text-xs text-[var(--text-dim)]">Rendering campus digital twin…</p>
      </div>
    </div>
  ),
});

function webglAvailable() {
  if (typeof window === "undefined") return true;
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

const OVERLAYS = [
  { id: "none", label: "None", icon: Layers },
  { id: "energy", label: "Energy", icon: Zap },
  { id: "occupancy", label: "Occupancy", icon: Users },
  { id: "accessibility", label: "Access", icon: Accessibility },
] as const;

export function CampusView() {
  const { data, isLoading } = useApi<BuildingLive[]>("/api/buildings", {
    refreshInterval: 15000,
  });
  const [supported, setSupported] = useState(true);
  const webglFailed = useCampus((s) => s.webglFailed);
  const overlay = useCampus((s) => s.overlay);
  const setOverlay = useCampus((s) => s.setOverlay);
  const daylight = useCampus((s) => s.daylight);
  const setDaylight = useCampus((s) => s.setDaylight);
  const resetCamera = useCampus((s) => s.resetCamera);
  const hoveredId = useCampus((s) => s.hoveredBuildingId);
  const selectedId = useCampus((s) => s.selectedBuildingId);
  const focusId = hoveredId ?? selectedId;

  useEffect(() => {
    setSupported(webglAvailable());
  }, []);

  const live = data ?? [];
  const use2D = !supported || webglFailed;
  const focusBuilding = live.find((b) => b.id === focusId);

  return (
    <div className="relative h-full w-full">
      {isLoading && !data ? (
        <div className="grid h-full place-items-center bg-[var(--bg)]">
          <div className="size-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cyan)]" />
        </div>
      ) : use2D ? (
        <CampusFallback live={live} />
      ) : (
        <CampusScene live={live} />
      )}

      {/* HUD — overlay toggles */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2 sm:left-4 sm:top-4">
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-xl border border-[var(--border)] p-1">
          {OVERLAYS.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                onClick={() => setOverlay(o.id)}
                className={cx(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  overlay === o.id
                    ? "bg-[var(--blue)]/20 text-[var(--text)]"
                    : "text-[var(--text-dim)] hover:bg-white/5",
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{o.label}</span>
              </button>
            );
          })}
        </div>
        {overlay !== "none" && <OverlayLegend overlay={overlay} />}
      </div>

      {/* HUD — camera reset + daylight */}
      <div className="absolute right-3 top-3 flex items-center gap-2 sm:right-4 sm:top-4">
        {!use2D && (
          <div className="glass flex items-center gap-1 rounded-xl border border-[var(--border)] p-1">
            {([
              ["day", Sun],
              ["night", Moon],
              ["xray", ScanLine],
            ] as const).map(([id, Icon]) => (
              <button
                key={id}
                onClick={() => setDaylight(id)}
                title={id === "xray" ? "X-ray view" : id}
                className={cx(
                  "grid size-7 place-items-center rounded-lg transition-colors",
                  daylight === id
                    ? "bg-[var(--cyan)]/20 text-[var(--cyan)]"
                    : "text-[var(--text-dim)] hover:bg-white/5",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        )}
        <button
          onClick={resetCamera}
          className="glass flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <RotateCcw className="size-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* HUD — focused building name */}
      {focusBuilding && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-lg border border-[var(--cyan)]/30 bg-black/70 px-3 py-1.5 text-center backdrop-blur">
          <div className="text-xs font-semibold text-white">{focusBuilding.name}</div>
          <div className="text-[12px] text-[var(--text-dim)]">
            {focusBuilding.category} · health {focusBuilding.healthScore}% ·{" "}
            {focusBuilding.occupancy}/{focusBuilding.capacity} people
          </div>
        </div>
      )}

      {/* HUD — hint */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/50 px-2.5 py-1.5 text-[12px] text-[var(--text-faint)] backdrop-blur sm:bottom-4 sm:left-4">
        <Maximize2 className="size-3" />
        {use2D ? "Tap a building to inspect it" : "Drag to orbit · scroll to zoom · click a building"}
      </div>
    </div>
  );
}

function OverlayLegend({ overlay }: { overlay: string }) {
  const items =
    overlay === "energy"
      ? [
          ["#22d3ee", "within baseline"],
          ["#f59e0b", "+12–25%"],
          ["#f87171", "+25% or more"],
        ]
      : overlay === "occupancy"
        ? [
            ["#3b82f6", "under 70%"],
            ["#f59e0b", "70–90%"],
            ["#f87171", "over 90% — congested"],
          ]
        : [
            ["#34d399", "step-free available"],
            ["#f87171", "lift out of service"],
          ];
  return (
    <div className="glass pointer-events-auto rounded-xl border border-[var(--border)] px-3 py-2 text-[12px]">
      {items.map(([c, label]) => (
        <div key={label} className="flex items-center gap-1.5 py-0.5">
          <span className="size-2 rounded-full" style={{ background: c }} />
          <span className="text-[var(--text-dim)]">{label}</span>
        </div>
      ))}
    </div>
  );
}
