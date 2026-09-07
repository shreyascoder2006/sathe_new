"use client";

import { create } from "zustand";

interface CampusState {
  selectedBuildingId: string | null;
  hoveredBuildingId: string | null;
  overlay: "none" | "energy" | "occupancy" | "accessibility";
  daylight: "day" | "night" | "xray";
  cameraResetKey: number;
  webglFailed: boolean;
  lastEvent: { at: number; label: string } | null;

  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setOverlay: (o: CampusState["overlay"]) => void;
  setDaylight: (d: CampusState["daylight"]) => void;
  resetCamera: () => void;
  setWebglFailed: (v: boolean) => void;
  pushEvent: (label: string) => void;
}

export const useCampus = create<CampusState>((set) => ({
  selectedBuildingId: null,
  hoveredBuildingId: null,
  overlay: "none",
  daylight: "day",
  cameraResetKey: 0,
  webglFailed: false,
  lastEvent: null,

  select: (id) => set({ selectedBuildingId: id }),
  hover: (id) => set({ hoveredBuildingId: id }),
  setOverlay: (overlay) => set({ overlay }),
  setDaylight: (daylight) => set({ daylight }),
  resetCamera: () =>
    set((s) => ({ cameraResetKey: s.cameraResetKey + 1, selectedBuildingId: null })),
  setWebglFailed: (webglFailed) => set({ webglFailed }),
  pushEvent: (label) => set({ lastEvent: { at: Date.now(), label } }),
}));
