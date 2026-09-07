/**
 * Lightweight time-series ML for NEXUS Campus.
 *
 * These are classical, explainable baselines — the kind the Smart Campus 360 brief
 * recommends starting with ("prediction models can start with classical ML / time-series
 * baselines"). Each function is a drop-in seam: replace the body with a call to a trained
 * model (Prophet / LSTM / gradient-boosted regressor) without changing any caller.
 */

export interface Sample {
  at: Date | string;
  value: number;
}

function toDate(x: Date | string) {
  return x instanceof Date ? x : new Date(x);
}

/** Hour-of-week index 0..167 (Mon 00:00 = 0). */
export function hourOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7; // Mon=0
  return day * 24 + d.getHours();
}

/** Median + MAD (median absolute deviation) — robust to outliers. */
function medianMad(xs: number[]) {
  if (xs.length === 0) return { median: 0, mad: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const median = s[Math.floor(s.length / 2)];
  const dev = s.map((x) => Math.abs(x - median)).sort((a, b) => a - b);
  const mad = dev[Math.floor(dev.length / 2)] || 1e-6;
  return { median, mad };
}

/**
 * Seasonal-naive + linear-trend forecast.
 * Builds a per-hour-of-week profile from history, then projects it forward and
 * adds the recent linear drift. Returns one point per hour for `horizonHours`.
 */
export function seasonalForecast(
  samples: Sample[],
  fromDate: Date,
  horizonHours: number,
): { at: Date; value: number; lo: number; hi: number }[] {
  if (samples.length < 24) {
    // not enough history — flat persistence
    const last = samples.at(-1)?.value ?? 0;
    return Array.from({ length: horizonHours }, (_, i) => ({
      at: new Date(fromDate.getTime() + (i + 1) * 3.6e6),
      value: last,
      lo: last * 0.8,
      hi: last * 1.2,
    }));
  }

  // bucket by hour-of-week
  const buckets = new Map<number, number[]>();
  for (const s of samples) {
    const k = hourOfWeek(toDate(s.at));
    const arr = buckets.get(k);
    if (arr) arr.push(s.value);
    else buckets.set(k, [s.value]);
  }
  const profile = new Map<number, { median: number; mad: number }>();
  for (const [k, xs] of buckets) profile.set(k, medianMad(xs));
  const globalStats = medianMad(samples.map((s) => s.value));

  // linear trend over the last ~72h
  const recent = samples.slice(-72);
  const n = recent.length;
  const xs = recent.map((_, i) => i);
  const ys = recent.map((s) => s.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const slope =
    xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0) /
    (xs.reduce((acc, x) => acc + (x - mx) ** 2, 0) || 1);

  return Array.from({ length: horizonHours }, (_, i) => {
    const at = new Date(fromDate.getTime() + (i + 1) * 3.6e6);
    const k = hourOfWeek(at);
    const seas = profile.get(k) ?? globalStats;
    const trend = slope * (i + 1) * 0.4; // damp the trend
    const value = Math.max(0, seas.median + trend);
    const band = Math.max(seas.mad * 2.2, value * 0.08);
    return { at, value: round(value), lo: round(Math.max(0, value - band)), hi: round(value + band) };
  });
}

/** Peak of a forecast window. */
export function forecastPeak(
  samples: Sample[],
  fromDate: Date,
  horizonHours: number,
) {
  const fc = seasonalForecast(samples, fromDate, horizonHours);
  return fc.reduce((best, p) => (p.value > best.value ? p : best), fc[0]);
}

/**
 * Robust anomaly score for the latest value against its hour-of-week history.
 * Returns a modified z-score (|value - median| / (1.4826 * MAD)). > 3.5 is "anomalous".
 */
export function anomalyScore(latest: number, history: Sample[]): {
  score: number;
  expected: number;
  band: number;
  anomalous: boolean;
} {
  const now = new Date();
  const k = history.length ? hourOfWeek(toDate(history[history.length - 1].at)) : hourOfWeek(now);
  const sameHour = history
    .filter((s) => hourOfWeek(toDate(s.at)) === k)
    .map((s) => s.value);
  const pool = sameHour.length >= 4 ? sameHour : history.map((s) => s.value);
  const { median, mad } = medianMad(pool);
  const score = mad > 0 ? Math.abs(latest - median) / (1.4826 * mad) : 0;
  return {
    score: round(score, 2),
    expected: round(median),
    band: round(1.4826 * mad * 3.5),
    anomalous: score > 3.5 && latest > median,
  };
}

function round(n: number, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
