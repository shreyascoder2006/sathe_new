/** Role-based experience — one platform, different views & permissions per persona.
 *  Mirrors §8 of the Smart Campus 360 brief. */

export type Role = "admin" | "maintenance" | "security" | "teacher" | "student";

export interface RoleConfig {
  id: Role;
  label: string;
  blurb: string;
  initials: string;
  landing: string;
  /** hrefs this role may open from the nav (order preserved from NAV) */
  nav: string[];
  /** may this role change incident/task/rule state, run simulations, etc. */
  canOperate: boolean;
  /** may this role run the demo simulation panel */
  canSimulate: boolean;
  /** accent for the persona chip */
  accent: string;
}

export const ROLES: Record<Role, RoleConfig> = {
  admin: {
    id: "admin",
    label: "Administrator",
    blurb: "Full digital twin, all intelligence modules, automation & simulation.",
    initials: "AK",
    landing: "/",
    nav: [
      "/",
      "/energy",
      "/flow",
      "/labs",
      "/queues",
      "/lost-found",
      "/security",
      "/accessibility",
      "/automation",
      "/incidents",
      "/impact",
    ],
    canOperate: true,
    canSimulate: true,
    accent: "#3b82f6",
  },
  maintenance: {
    id: "maintenance",
    label: "Maintenance",
    blurb: "Asset health, predictive alerts, work orders and energy faults.",
    initials: "RP",
    landing: "/labs",
    nav: ["/", "/labs", "/energy", "/accessibility", "/automation", "/incidents"],
    canOperate: true,
    canSimulate: false,
    accent: "#8b5cf6",
  },
  security: {
    id: "security",
    label: "Security",
    blurb: "Campus map, crowd density, incidents and emergency response.",
    initials: "SC",
    landing: "/security",
    nav: ["/", "/security", "/flow", "/accessibility", "/incidents"],
    canOperate: true,
    canSimulate: false,
    accent: "#f87171",
  },
  teacher: {
    id: "teacher",
    label: "Teacher",
    blurb: "Classroom status, campus flow, services and issue reporting.",
    initials: "PJ",
    landing: "/companion",
    nav: ["/companion", "/", "/flow", "/queues", "/lost-found"],
    canOperate: false,
    canSimulate: false,
    accent: "#2dd4bf",
  },
  student: {
    id: "student",
    label: "Student",
    blurb: "Campus companion — timetable, navigation, library, canteen, lost & found.",
    initials: "ST",
    landing: "/companion",
    nav: ["/companion", "/", "/flow", "/queues", "/lost-found"],
    canOperate: false,
    canSimulate: false,
    accent: "#22d3ee",
  },
};

export const ROLE_LIST = Object.values(ROLES);
export const DEFAULT_ROLE: Role = "admin";

export function roleFromValue(v: string | undefined | null): Role {
  return v && v in ROLES ? (v as Role) : DEFAULT_ROLE;
}
