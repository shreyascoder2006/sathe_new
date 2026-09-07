import {
  LayoutDashboard,
  Zap,
  Users,
  Activity,
  Clock,
  Search,
  ShieldAlert,
  Accessibility,
  Workflow,
  TriangleAlert,
  TrendingUp,
  GraduationCap,
  Globe,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "Landing Page", icon: Globe, group: "Campus" },
  { href: "/command", label: "Command Center", icon: LayoutDashboard, group: "Campus" },
  { href: "/companion", label: "Campus Companion", icon: GraduationCap, group: "Campus" },
  { href: "/energy", label: "EnergyMind", icon: Zap, group: "Intelligence" },
  { href: "/flow", label: "CampusFlow", icon: Users, group: "Intelligence" },
  { href: "/labs", label: "LabPulse", icon: Activity, group: "Intelligence" },
  { href: "/queues", label: "QueueLess", icon: Clock, group: "Services" },
  { href: "/lost-found", label: "LostLoop", icon: Search, group: "Services" },
  { href: "/security", label: "CampusShield", icon: ShieldAlert, group: "Services" },
  { href: "/accessibility", label: "CampusCare", icon: Accessibility, group: "Services" },
  { href: "/automation", label: "Automation Center", icon: Workflow, group: "Operations" },
  { href: "/incidents", label: "Incidents", icon: TriangleAlert, group: "Operations" },
  { href: "/impact", label: "Impact", icon: TrendingUp, group: "Operations" },
] as const;

export const NAV_GROUPS = ["Campus", "Intelligence", "Services", "Operations"] as const;
