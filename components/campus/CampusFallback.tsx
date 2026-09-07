"use client";

import { CAMPUS_BUILDINGS, CAMPUS_BOUNDS } from "@/lib/geo/campus";
import { useCampus } from "@/lib/store";
import type { BuildingLive } from "./types";
import { buildingTone, overlayValue } from "./types";

/** Polished 2D campus plan — used when WebGL is unavailable. Same selection model. */
export function CampusFallback({ live }: { live: BuildingLive[] }) {
  const selectedId = useCampus((s) => s.selectedBuildingId);
  const overlay = useCampus((s) => s.overlay);
  const select = useCampus((s) => s.select);
  const liveById = Object.fromEntries(live.map((b) => [b.id, b]));

  const W = CAMPUS_BOUNDS.width + 80;
  const D = CAMPUS_BOUNDS.depth + 80;

  return (
    <div className="grid-ambient h-full w-full overflow-auto bg-[var(--bg)] p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-dim)]">
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-300">
            WebGL unavailable — 2D campus plan
          </span>
          <span>Approximate digital twin of Sathaye College</span>
        </div>
        <svg
          viewBox={`${-W / 2} ${-D / 2} ${W} ${D}`}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-1)]"
          style={{ aspectRatio: `${W} / ${D}` }}
        >
          <defs>
            <pattern id="fbgrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect x={-W / 2} y={-D / 2} width={W} height={D} fill="url(#fbgrid)" />

          {CAMPUS_BUILDINGS.map((b) => {
            const l = liveById[b.id];
            const tone = l ? buildingTone(l) : "#475569";
            const ov = l ? overlayValue(l, overlay) : null;
            const isSel = selectedId === b.id;
            const fill =
              ov && ov.intensity > 0.05
                ? ov.color
                : b.id === "sports-ground"
                  ? "#2f8f47"
                  : b.facade.wall;
            return (
              <g
                key={b.id}
                transform={`translate(${b.position[0]}, ${b.position[1]})`}
                onClick={() => select(isSel ? null : b.id)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={-b.size[0] / 2}
                  y={-b.size[1] / 2}
                  width={b.size[0]}
                  height={b.size[1]}
                  rx={2}
                  fill={fill}
                  fillOpacity={ov ? 0.25 + ov.intensity * 0.5 : b.id === "sports-ground" ? 0.55 : 0.85}
                  stroke={isSel ? "#22d3ee" : tone}
                  strokeWidth={isSel ? 2 : 0.8}
                />
                <text
                  textAnchor="middle"
                  dy={2}
                  fontSize={5}
                  fill="#1e293b"
                  style={{ pointerEvents: "none", fontWeight: 600 }}
                >
                  {b.shortName}
                </text>
                {l && (
                  <circle
                    cx={b.size[0] / 2 - 3}
                    cy={-b.size[1] / 2 + 3}
                    r={1.6}
                    fill={tone}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
