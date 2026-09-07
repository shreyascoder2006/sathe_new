# NEXUS Campus — Smart Campus 360

**The intelligent operating system for a smarter campus.**

A production-quality prototype of a Smart Campus operations platform for **Sathaye College,
Vile Parle East, Mumbai**. The primary interface is a navigable **3D digital twin** of the
campus: explore the campus → select a building → view its live intelligence → investigate an
anomaly → watch the platform take an automated action → see the measurable impact.

> The 3D model is an **approximate digital twin** — footprints, positions and heights are
> hand-authored from public references, not a survey. Sensor/energy/occupancy data is
> **simulated** but fully persisted; there is no real IoT or CCTV integration.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4, dark-first command-center HUD |
| 3D | **vanilla three.js** (`components/campus/CampusScene.tsx`) — see note below |
| Backend | `backend/` folder — Prisma + all server logic; HTTP handlers in `app/api/**` call into it |
| Database | **SQLite** via Prisma (`backend/prisma/dev.db`) — swap `provider` to `postgresql` to scale |
| Validation | Zod on every API route |
| Client data | SWR (revalidating) + Zustand (campus selection / camera state) |
| Charts | Recharts |
| AI | Deterministic rule-based engine, with an optional LLM adapter (Groq / Gemini / Anthropic — auto-detected) |

> **Note:** `@react-three/fiber` 9.7 does not mount under React 19.2 / Next 16, so the twin is
> written directly against three.js. Same result, zero framework-compat risk.

## Getting started

```bash
npm install
npm run db:seed     # creates backend/prisma/dev.db and seeds ~13k rows for Sathaye College
npm run dev         # http://localhost:3000
```

Optional: add a **free** `GROQ_API_KEY` ([console.groq.com](https://console.groq.com/keys)) or
`GEMINI_API_KEY` ([aistudio.google.com](https://aistudio.google.com/apikey)) to `.env` to
upgrade the AI explanations and the NEXUS assistant from templated to model-authored — the
adapter (`backend/ai/llm.ts`) auto-detects whichever key is set. The app is fully functional
without any key.

`npm run db:reset` wipes and reseeds.

## What's implemented

### Personas — role-based experience (§8 of the brief)

Switch persona from the top-right menu. Each role gets its own landing screen, a filtered
navigation, and enforced permissions (`backend/session.ts` guards every mutating route).

| Role | Lands on | Sees | Can operate? |
|---|---|---|---|
| **Administrator** | Command Center | Everything — twin, all modules, automation, simulation | yes + simulate |
| **Maintenance** | LabPulse | Twin, LabPulse, EnergyMind, CampusCare, Automation, Incidents | yes |
| **Security** | CampusShield | Twin, CampusShield, CampusFlow, CampusCare, Incidents | yes |
| **Teacher** | Campus Companion | Companion, twin, CampusFlow, QueueLess, LostLoop | read-only + report issues |
| **Student** | Campus Companion | Companion, twin, CampusFlow, QueueLess, LostLoop | read-only + report / order |

**Campus Companion** (`/companion`) is the student/teacher home: live timetable with "now / next
class" and navigation, a "is it busy right now?" campus pulse, canteen **order-ahead** with a
demand forecast, and issue reporting that opens a triaged incident with the building
auto-identified.

### AI / ML

See [`docs/AI-ML.md`](docs/AI-ML.md) for the full map. In short: `backend/ml/forecast.ts` holds
a seasonal-naive + trend forecaster (energy peak, crowd surges) and a robust MAD z-score
anomaly detector; `backend/ai/` holds templated-or-LLM explanations, the grounded assistant,
and the lost-and-found matcher. Each is a swappable seam for a trained model.

### The digital twin (primary interface)
- Orbit / zoom / pan / reset, hover names, click-to-select with a smooth camera move
- Selection glow + energy-flow rings on the chosen building
- Toggleable data overlays: **energy**, **occupancy**, **accessibility** — all driven by DB values
- Day / night / x-ray view modes
- Polished 2D SVG campus-plan fallback if WebGL is unavailable

### Intelligence modules
- **EnergyMind** — building-wise consumption vs baseline, anomaly detection, estimated wastage (kWh + ₹), recommendations
- **CampusFlow** — occupancy/density by building, predicted congestion windows, alternate-route recommendations
- **LabPulse** — equipment health, live sensor trends, failure-risk score, predicted service date, task creation
- **QueueLess** — service queue length + estimated wait, predicted peak, recommended off-peak window
- **LostLoop** — lost/found reports with AI matching (description + category + location + time), claim workflow
- **CampusShield** — restricted-area / off-hours incident monitoring + response timeline (simulation-based)
- **CampusCare** — lift status, step-free routes, obstacle reports, automatic accessibility re-routing

### Operations
- **Automation Center** — 6 rules with enable/disable toggles + a full step-by-step execution trace per run
- **Incident Management** — filterable table + detail view; change status / assignee / severity → persists; links to evidence, AI analysis, automation execution and tasks
- **Impact Dashboard** — issues detected/resolved, avg response time, energy anomalies, tasks completed, estimated staff-time and cost saved
- **NEXUS AI** assistant (floating) — answers grounded strictly in live DB data

### Backend — `backend/`

All server-side code lives in `backend/`. (The HTTP handlers themselves must stay under
`app/api/**` because Next.js discovers routes by folder — each one is a thin wrapper that calls
into `backend/`.)

```
backend/
  prisma/
    schema.prisma      20+ related models (SQLite; swap provider for Postgres)
    seed.ts            seeds Sathaye College — ~13k rows
    dev.db             the database file
  db.ts               PrismaClient singleton
  http.ts             route helpers — ok() / fail() / handle() with Zod error handling
  session.ts          persona cookie + requireOperator() / requireSimulator() guards
  queries.ts          campus metrics + building-live aggregation + impact rollups
  anomaly/detect.ts   statistical + z-score detectors: energy / occupancy / equipment / queue
  ml/forecast.ts      seasonal forecaster + robust MAD anomaly score (swappable ML seam)
  automation/engine.ts  rule evaluation → incident + task + notification + execution trace
  sim/                historical + live data generators; demo-scenario orchestrator
  ai/                  templated explanations, grounded assistant, lost&found matcher, Groq/Gemini/Anthropic adapter
```

Routes added for personas: `/api/session`, `/api/timetable`, `/api/canteen`, `/api/report`.

- ~22 API routes under `app/api/**`, each with Zod validation; every screen has loading / empty / error states.
- Truly shared code (types, formatters, the campus geometry, client stores) stays in `lib/`.

## Demo flow

Command Center → **Demo** in the bottom dock → *Energy anomaly*. Watch:
grid draw spikes in the Science Block → anomaly detected → AI explanation attached →
incident `INC-xxxx` opened → maintenance task assigned to Facilities → administrators
notified → building status → critical → Automation Center shows the 6-step trace →
Impact Dashboard totals move. Every record survives a hard refresh.
