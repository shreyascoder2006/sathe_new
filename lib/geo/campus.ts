/**
 * NEXUS Campus — approximate digital twin layout of Sathaye College,
 * Dixit Road, Vile Parle (East), Mumbai (~5-acre campus).
 *
 * IMPORTANT: still an APPROXIMATION, but now shaped and coloured from the college's
 * actual look — a cream-plaster, flat-roofed multi-storey academic block with
 * open-corridor balconies and a rhythm of pillars, arranged in an L around a large
 * green artificial-turf ground that fronts the road (public photos + Google imagery,
 * plus the published fact that there is "a big ground in front of the college
 * building"). Not a survey; every building carries `approxNote` and the UI labels
 * the whole model an "approximate digital twin".
 *
 * Coordinate frame: metres. +x = east, +z = south (toward Dixit Road), y = up.
 */

export type BuildingCategory =
  | "Academic"
  | "Laboratory"
  | "Library"
  | "Dining"
  | "Administration"
  | "Security"
  | "Sports"
  | "Support";

/** How the facade is drawn in the 3D twin. */
export interface Facade {
  /** wall plaster colour */
  wall: string;
  /** ground-floor / plinth band colour */
  base: string;
  /** open balcony corridor rhythm on one face, like the real academic wings */
  openCorridor?: boolean;
  /** which local face the open corridor / main frontage looks at */
  openSide?: "north" | "south" | "east" | "west";
  /** pitched Mangalore-tile roof (the heritage entrance block) */
  pitchedRoof?: boolean;
}

export interface CampusBuilding {
  id: string;
  name: string;
  shortName: string;
  category: BuildingCategory;
  description: string;
  floors: number;
  size: [number, number];
  position: [number, number];
  height: number;
  rotation: number;
  accent: string;
  facade: Facade;
  view: { position: [number, number, number]; target: [number, number, number] };
  entrances: { label: string; offset: [number, number]; stepFree: boolean }[];
}

export const CAMPUS_BOUNDS = { width: 250, depth: 230 };

const CREAM = "#e4d9bd";
const CREAM_DK = "#d8c9a4";
const OCHRE = "#8f6f4c";
const BRICK = "#7c5a44";

export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    id: "main-building",
    name: "Main Academic Wing",
    shortName: "Main Wing",
    category: "Academic",
    description:
      "The long cream-plaster teaching wing running along the west edge of the ground — five floors of lecture halls and departments, fronted by the open balcony corridor with its row of square pillars. The heritage entrance and principal's office are at the road end.",
    floors: 5,
    size: [20, 104],
    position: [-58, 30],
    height: 21,
    rotation: 0,
    accent: "#3B82F6",
    facade: { wall: CREAM, base: OCHRE, openCorridor: true, openSide: "east" },
    view: { position: [8, 34, 44], target: [-58, 10, 30] },
    entrances: [
      { label: "Heritage Portico (road end)", offset: [0, 50], stepFree: false },
      { label: "Courtyard Ramp", offset: [10, 6], stepFree: true },
    ],
  },
  {
    id: "junior-college",
    name: "North Teaching Block",
    shortName: "North Block",
    category: "Academic",
    description:
      "The wing closing the top of the L, along the north edge of the ground. FYJC/SYJC classrooms and several senior-college divisions, connected to the Main Wing at the corner by a covered corridor.",
    floors: 5,
    size: [92, 18],
    position: [-4, -20],
    height: 21,
    rotation: 0,
    accent: "#38BDF8",
    facade: { wall: CREAM_DK, base: OCHRE, openCorridor: true, openSide: "south" },
    view: { position: [-4, 34, 44], target: [-4, 10, -20] },
    entrances: [{ label: "Corner Foyer", offset: [-40, 6], stepFree: true }],
  },
  {
    id: "science-block",
    name: "Science & Laboratory Block",
    shortName: "Science Block",
    category: "Laboratory",
    description:
      "Physics, Chemistry, Botany, Zoology and Computer Science laboratories, the instrumentation room and departmental research space. Sits on the east side of the ground.",
    floors: 4,
    size: [24, 46],
    position: [44, -6],
    height: 18,
    rotation: 0,
    accent: "#8B5CF6",
    facade: { wall: CREAM, base: BRICK, openCorridor: true, openSide: "west" },
    view: { position: [4, 30, 8], target: [44, 9, -6] },
    entrances: [
      { label: "West Entrance", offset: [-13, 0], stepFree: true },
      { label: "Lift Lobby", offset: [-13, 16], stepFree: true },
    ],
  },
  {
    id: "library",
    name: "Central Library",
    shortName: "Library",
    category: "Library",
    description:
      "Reading halls, reference section, digital catalogue terminals and the periodicals room — behind the north block, away from the ground noise.",
    floors: 3,
    size: [32, 22],
    position: [-40, -46],
    height: 13,
    rotation: 0,
    accent: "#22D3EE",
    facade: { wall: CREAM, base: OCHRE },
    view: { position: [-40, 24, -4], target: [-40, 7, -46] },
    entrances: [{ label: "Reading Hall Entry", offset: [0, 12], stepFree: true }],
  },
  {
    id: "admin-exam",
    name: "Administrative & Examination Block",
    shortName: "Admin & Exam",
    category: "Administration",
    description:
      "College office, admissions, accounts, the Examination Cell and student-services counters — near the main gate so visitors reach it first.",
    floors: 2,
    size: [30, 18],
    position: [-58, 78],
    height: 10,
    rotation: 0,
    accent: "#2DD4BF",
    facade: { wall: CREAM, base: OCHRE },
    view: { position: [-58, 22, 122], target: [-58, 5, 78] },
    entrances: [{ label: "Office Counter Entry", offset: [0, 10], stepFree: true }],
  },
  {
    id: "canteen",
    name: "Sathaye College Canteen",
    shortName: "Canteen",
    category: "Dining",
    description:
      "The large self-service canteen hall with its long wooden bench tables and the adjacent photocopy / stationery kiosk. Peak load during the 11:00 and 13:00 breaks.",
    floors: 1,
    size: [26, 16],
    position: [46, 44],
    height: 6,
    rotation: 0,
    accent: "#F59E0B",
    facade: { wall: "#efe6cf", base: "#c9b48a" },
    view: { position: [46, 18, 88], target: [46, 4, 44] },
    entrances: [{ label: "Self-Service Entry", offset: [0, 9], stepFree: true }],
  },
  {
    id: "gymkhana",
    name: "Gymkhana & Auditorium",
    shortName: "Gymkhana",
    category: "Sports",
    description:
      "Indoor gymkhana, the 163-seat college auditorium and the NSS / NCC rooms — used for events, cultural practice and assemblies.",
    floors: 2,
    size: [36, 30],
    position: [70, -44],
    height: 14,
    rotation: 0,
    accent: "#F472B6",
    facade: { wall: CREAM_DK, base: BRICK },
    view: { position: [70, 30, 4], target: [70, 6, -44] },
    entrances: [
      { label: "Auditorium Lobby", offset: [0, 16], stepFree: true },
      { label: "East Accessible Door", offset: [19, 0], stepFree: true },
    ],
  },
  {
    id: "sports-ground",
    name: "Sports Ground (turf)",
    shortName: "Ground",
    category: "Sports",
    description:
      "The green artificial-turf ground that fronts the college along Dixit Road — football practice, athletics and the annual sports day. Ringed by the red-and-blue perimeter fence. Not an enclosed structure.",
    floors: 0,
    size: [92, 74],
    position: [-4, 40],
    height: 0.5,
    rotation: 0,
    accent: "#22C55E",
    facade: { wall: "#3fae5a", base: "#2f8f47" },
    view: { position: [-4, 44, 132], target: [-4, 0, 40] },
    entrances: [{ label: "Ground Gate", offset: [0, 37], stepFree: true }],
  },
  {
    id: "security-gate",
    name: "Main Gate & Security Cabin",
    shortName: "Security",
    category: "Security",
    description:
      "The Dixit Road gate with the visitor register, CCTV monitor wall and the campus security desk.",
    floors: 1,
    size: [12, 7],
    position: [-4, 92],
    height: 4.5,
    rotation: 0,
    accent: "#EF4444",
    facade: { wall: "#d9cdb0", base: "#5c5c5c" },
    view: { position: [-4, 14, 122], target: [-4, 3, 92] },
    entrances: [{ label: "Gate Desk", offset: [0, 5], stepFree: true }],
  },
];

export const CAMPUS_ENTRANCES = [
  { id: "main-gate", label: "Main Gate · Dixit Road", position: [-4, 98] as [number, number] },
  { id: "service-gate", label: "Service Gate (north-east)", position: [66, -8] as [number, number] },
];

/** Decorative trees — the campus is leafy, especially around the ground. */
export const CAMPUS_TREES: [number, number][] = [
  [-40, 88], [-20, 90], [8, 90], [30, 88], [48, 84], [62, 74],
  [-44, 72], [-44, 44], [-44, 14], [-44, -6],
  [40, 30], [42, 60], [58, 40], [30, -34], [8, -36], [-20, -38], [-46, -22],
  [-70, 20], [-70, 50], [72, -12], [72, 18],
];

export const CAMPUS_LAMPS: [number, number][] = [
  [-4, 84], [-4, 66], [-4, 20], [-30, 40], [22, 40], [-44, 30], [40, 12], [-40, -30], [66, -30],
];

export const buildingById = (id: string) =>
  CAMPUS_BUILDINGS.find((b) => b.id === id);

export const CATEGORY_COLORS: Record<BuildingCategory, string> = {
  Academic: "#3B82F6",
  Laboratory: "#8B5CF6",
  Library: "#22D3EE",
  Dining: "#F59E0B",
  Administration: "#2DD4BF",
  Security: "#EF4444",
  Sports: "#22C55E",
  Support: "#94A3B8",
};

export const DEFAULT_CAMERA = {
  position: [46, 120, 176] as [number, number, number],
  target: [-6, 0, 22] as [number, number, number],
};
