# Where AI / ML lives in NEXUS Campus

Every intelligent behaviour is a **named seam**: a classical, explainable baseline today,
swappable for a trained model without touching any caller. This is the approach the
Smart Campus 360 brief recommends ("prediction models can start with classical ML /
time-series baselines … upgrade if time permits").

| Capability | Where | Technique today | Drop-in upgrade |
|---|---|---|---|
| **Anomaly detection** (energy) | `backend/anomaly/detect.ts` → `anomalyScore()` in `backend/ml/forecast.ts` | Robust modified **z-score** (median / MAD) against the same hour-of-week over 3 weeks. `> 3.5` flags. | Isolation Forest / autoencoder reconstruction error per building. |
| **Anomaly detection** (occupancy, equipment, queue) | `backend/anomaly/detect.ts` | Deviation-from-baseline thresholds + consecutive-sample persistence. | Same z-score treatment; per-asset survival models for equipment. |
| **Energy demand forecast** | `backend/ml/forecast.ts` → `seasonalForecast()`, `forecastPeak()` | **Seasonal-naive + damped linear trend**: per-hour-of-week profile from history, projected forward, plus recent drift. Returns value + confidence band. Surfaced in EnergyMind ("forecast peak 24h"). | Prophet / SARIMA / gradient-boosted regressor on weather + timetable features. |
| **Crowd / congestion prediction** | `/api/occupancy` uses `seasonalForecast()` | Same forecaster on headcount; windows above 78% of capacity become "predicted surges" with people counts. Surfaced in CampusFlow. | Sequence model (LSTM/TCN) on inflow/outflow + event calendar. |
| **Queue / wait-time prediction** | `backend/sim/engine.ts` → `queueFor()`, `/api/services` | Historical peak curve + service-rate model → predicted peak & recommended off-peak window. | Quantile regression on counter throughput + pre-order signal. |
| **Canteen demand forecast** | `/api/canteen` | Pre-orders + the queue model → per-window predicted order volume. | Item-level demand model; the pre-order stream is the training label. |
| **Anomaly explanation** | `backend/ai/explain.ts` | Deterministic templates filled with the real anomaly numbers (what / why / cause / impact / action). | `GROQ_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` set → `backend/ai/llm.ts` rewrites the same evidence via that provider (Groq Llama 3.3 / Gemini Flash / Claude); falls back on any error. |
| **NEXUS AI assistant** | `backend/ai/assistant.ts`, `/api/assistant` | Intent classification → grounded DB queries → answer with source rows. Never invents campus facts. | RAG over campus documents + tool-calling; retrieval stays the grounding layer. |
| **Lost & found matching** | `backend/ai/match.ts` | Token overlap + category + location + colour + time-proximity → confidence score + rationale. | Image embedding similarity + sentence-transformer description match. |
| **Automation decisioning** | `backend/automation/engine.ts` | Rule engine: `trigger + conditions (minDeviationPct / minSeverity)` → ordered actions, full execution trace. | Learned policy / bandit over which action resolves which anomaly fastest. |

## Data the models run on

`backend/sim/` generates ~13k rows of realistic history (21 days hourly) on seed and appends
fresh readings on every campus-clock tick or demo event — all persisted. Swap the generators
for a real ingestion layer (CCTV-derived counts, IoT meters, BMS) and every model above keeps
working unchanged.

## Why classical first

- **Explainable** — an administrator sees "3.8σ above the Tuesday-10am norm", not a black-box score.
- **No training loop / GPU** for the prototype; deterministic and demo-safe.
- **Honest** — the UI labels detection as statistical and AI text as templated unless a key is present.
