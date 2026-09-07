/** Per-building simulation profiles. Values are plausible for a Mumbai
 *  degree college; they are simulated, not metered. */

export interface BuildingProfile {
  /** typical mid-day peak grid draw, kW */
  peakKw: number;
  /** overnight base load fraction of peak */
  baseFraction: number;
  /** total usable occupancy across the building */
  capacity: number;
  /** does this building run air-conditioning heavily (raises mid-day energy) */
  hvacHeavy: boolean;
}

export const BUILDING_PROFILES: Record<string, BuildingProfile> = {
  "main-building": { peakKw: 165, baseFraction: 0.18, capacity: 900, hvacHeavy: true },
  "junior-college": { peakKw: 120, baseFraction: 0.14, capacity: 720, hvacHeavy: true },
  "science-block": { peakKw: 210, baseFraction: 0.26, capacity: 540, hvacHeavy: true },
  "library": { peakKw: 74, baseFraction: 0.22, capacity: 300, hvacHeavy: true },
  "admin-exam": { peakKw: 58, baseFraction: 0.16, capacity: 180, hvacHeavy: true },
  "canteen": { peakKw: 92, baseFraction: 0.12, capacity: 260, hvacHeavy: false },
  "gymkhana": { peakKw: 88, baseFraction: 0.1, capacity: 700, hvacHeavy: false },
  "sports-ground": { peakKw: 12, baseFraction: 0.25, capacity: 400, hvacHeavy: false },
  "security-gate": { peakKw: 6, baseFraction: 0.6, capacity: 6, hvacHeavy: false },
};

/** 0..1 multiplier for grid draw by hour of day (college rhythm). */
export function energyShape(hour: number): number {
  const table = [
    0.16, 0.15, 0.15, 0.15, 0.16, 0.2, 0.32, 0.55, 0.82, 0.96, 1.0, 0.98, 0.94, 0.97, 0.99,
    0.9, 0.74, 0.58, 0.44, 0.36, 0.3, 0.26, 0.22, 0.18,
  ];
  return table[((hour % 24) + 24) % 24];
}

/** 0..1 multiplier for occupancy by hour; weekends much lighter. */
export function occupancyShape(hour: number, weekday: number): number {
  const table = [
    0, 0, 0, 0, 0, 0, 0.02, 0.12, 0.55, 0.95, 0.88, 0.7, 0.82, 0.9, 0.78, 0.52, 0.34, 0.18,
    0.1, 0.06, 0.03, 0.01, 0, 0,
  ];
  const base = table[((hour % 24) + 24) % 24];
  const weekend = weekday === 0 ? 0.12 : weekday === 6 ? 0.4 : 1;
  return base * weekend;
}

/** deterministic pseudo-random in [0,1) from an integer seed */
export function rng(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function noise(seed: number, amplitude: number): number {
  return (rng(seed) - 0.5) * 2 * amplitude;
}

export interface EquipmentSeed {
  name: string;
  category: string;
  location: string;
  buildingId: string;
  metric: "vibration_mm_s" | "temperature_c" | "current_a";
  baseline: number;
  amplitude: number;
  ageMonths: number;
}

export const EQUIPMENT_SEED: EquipmentSeed[] = [
  { name: "CNC Milling Machine", category: "Fabrication", location: "Workshop, Science Block G-04", buildingId: "science-block", metric: "vibration_mm_s", baseline: 2.1, amplitude: 0.25, ageMonths: 46 },
  { name: "Central AHU – Science Block", category: "HVAC", location: "Science Block terrace", buildingId: "science-block", metric: "vibration_mm_s", baseline: 3.4, amplitude: 0.4, ageMonths: 62 },
  { name: "UV-Vis Spectrophotometer", category: "Analytical", location: "Chemistry Lab, Science Block 201", buildingId: "science-block", metric: "temperature_c", baseline: 24.5, amplitude: 0.6, ageMonths: 28 },
  { name: "PCR Thermal Cycler", category: "Analytical", location: "Biotech Lab, Science Block 208", buildingId: "science-block", metric: "temperature_c", baseline: 26.0, amplitude: 0.8, ageMonths: 19 },
  { name: "Computer Lab HVAC Split #3", category: "HVAC", location: "Computer Lab, Junior College 3F", buildingId: "junior-college", metric: "current_a", baseline: 12.4, amplitude: 0.9, ageMonths: 40 },
  { name: "Server Rack UPS", category: "Electrical", location: "Server Room, Main Building", buildingId: "main-building", metric: "temperature_c", baseline: 27.5, amplitude: 1.0, ageMonths: 33 },
  { name: "Library Chiller Pump", category: "HVAC", location: "Library plant room", buildingId: "library", metric: "vibration_mm_s", baseline: 2.8, amplitude: 0.3, ageMonths: 51 },
  { name: "Auditorium HVAC Compressor", category: "HVAC", location: "Gymkhana plant deck", buildingId: "gymkhana", metric: "current_a", baseline: 18.6, amplitude: 1.2, ageMonths: 44 },
  { name: "Physics Lab Oscilloscope Bench", category: "Electrical", location: "Physics Lab, Science Block 104", buildingId: "science-block", metric: "current_a", baseline: 6.2, amplitude: 0.4, ageMonths: 22 },
  { name: "Canteen Cold Storage Unit", category: "Electrical", location: "Canteen back store", buildingId: "canteen", metric: "temperature_c", baseline: 4.0, amplitude: 0.7, ageMonths: 37 },
  { name: "Passenger Lift B", category: "Electrical", location: "Science Block lift shaft B", buildingId: "science-block", metric: "vibration_mm_s", baseline: 1.6, amplitude: 0.2, ageMonths: 58 },
  { name: "Passenger Lift A", category: "Electrical", location: "Main Building lift shaft A", buildingId: "main-building", metric: "vibration_mm_s", baseline: 1.4, amplitude: 0.18, ageMonths: 41 },
];

export const SERVICE_SEED = [
  { name: "Examination Cell Counter", category: "Administrative", buildingId: "admin-exam", description: "Hall tickets, revaluation forms, mark-sheet collection.", isQueued: true, avgServiceMinutes: 4.5 },
  { name: "Admissions & Fees Counter", category: "Administrative", buildingId: "admin-exam", description: "Fee payment, bonafide certificates, admission queries.", isQueued: true, avgServiceMinutes: 5.5 },
  { name: "Library Circulation Desk", category: "Support", buildingId: "library", description: "Issue / return of books, reading-hall passes.", isQueued: true, avgServiceMinutes: 2.0 },
  { name: "Canteen Servery", category: "Dining", buildingId: "canteen", description: "Meal and snack counter — heavy load at breaks.", isQueued: true, avgServiceMinutes: 1.6 },
  { name: "Photocopy & Stationery Kiosk", category: "Support", buildingId: "canteen", description: "Printouts, photocopies, exam stationery.", isQueued: true, avgServiceMinutes: 2.4 },
  { name: "Student Services Help Desk", category: "Administrative", buildingId: "admin-exam", description: "Scholarship, railway concession, ID card reissue.", isQueued: true, avgServiceMinutes: 6.0 },
  { name: "Principal's Office", category: "Administrative", buildingId: "main-building", description: "Appointments and approvals.", isQueued: false, avgServiceMinutes: 10 },
  { name: "IT Support Room", category: "Facilities", buildingId: "main-building", description: "Wi-Fi, portal and lab-PC support.", isQueued: false, avgServiceMinutes: 8 },
];
