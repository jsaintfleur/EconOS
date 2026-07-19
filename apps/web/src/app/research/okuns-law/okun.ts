import { getSeries } from "@/lib/data";
import { alignSeries, ols, periodChange } from "@/lib/econ";
import { quarterlyAverage } from "../transforms";

/**
 * Okun's-law estimation, computed once at build time and shared by the
 * module page (scatter, fits, findings) and the research index card (the
 * headline coefficient). Keeping the calculation in one module guarantees
 * the two never disagree.
 *
 * Design: the quarterly change in the unemployment rate (quarterly average
 * of the monthly rate, then first difference) regressed on published real
 * GDP growth (% SAAR, quarter over quarter), 1960 to present. The slope is
 * the quarterly Okun coefficient; −intercept/slope is the growth rate
 * historically consistent with a stable unemployment rate.
 */

export interface OkunFit {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
  /** Human-readable estimation window, e.g. "1960–1989". */
  window: string;
}

export interface OkunPoint {
  /** Quarter-start ISO date. */
  date: string;
  /** Real GDP growth, % SAAR. */
  growth: number;
  /** Quarterly change in the unemployment rate, pp. */
  unemploymentChange: number;
}

export interface OkunResults {
  points: OkunPoint[];
  full: OkunFit;
  /** Subperiod fits — the coefficient is not stable across decades. */
  early: OkunFit; // 1960–1989
  late: OkunFit; // 1990–present
  /** Growth rate implied to hold unemployment steady: −intercept/slope. */
  stableGrowthRate: number;
}

const SAMPLE_START = "1960-01-01";
const LATE_START = "1990-01-01";

function fitWindow(points: OkunPoint[], window: string): OkunFit {
  const fit = ols(points.map((p): [number, number] => [p.growth, p.unemploymentChange]));
  return { ...fit, window };
}

function computeOkun(): OkunResults {
  const gdp = getSeries("real_gdp_growth").observations;
  // Quarterly-average the monthly unemployment rate (calendar-aware; the
  // quarter containing the missing 2025-10 month averages two months), then
  // take the quarter-over-quarter change in percentage points. Quarters are
  // contiguous after averaging, so the index-based periodChange is safe.
  const quarterlyUnemployment = quarterlyAverage(getSeries("unemployment_rate").observations);
  const unemploymentChange = periodChange(quarterlyUnemployment);

  const points: OkunPoint[] = alignSeries(gdp, unemploymentChange)
    .filter(([date]) => date >= SAMPLE_START)
    .map(
      ([date, growth, change]): OkunPoint => ({
        date,
        growth,
        unemploymentChange: change,
      }),
    );

  const lastYear = points[points.length - 1]?.date.slice(0, 4) ?? "";
  const full = fitWindow(points, `1960–${lastYear}`);
  return {
    points,
    full,
    early: fitWindow(points.filter((p) => p.date < LATE_START), "1960–1989"),
    late: fitWindow(points.filter((p) => p.date >= LATE_START), `1990–${lastYear}`),
    stableGrowthRate: -full.intercept / full.slope,
  };
}

/** Estimated once per build at module scope. */
export const okunResults: OkunResults = computeOkun();
