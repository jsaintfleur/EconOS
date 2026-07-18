import type { Observation, SeriesSnapshot } from "./types";

/**
 * Economic calculation library.
 *
 * Every formula rendered anywhere in EconOS lives here, is documented in
 * docs/economic-methodology.md, and is unit-tested in src/lib/econ.test.ts.
 * UI components must not do arithmetic on observations directly.
 */

/** Number of periods that make up one year, per snapshot frequency. */
export const PERIODS_PER_YEAR: Record<SeriesSnapshot["frequency"], number> = {
  D: 261, // trading days, approximate — only used for labeling, never math
  W: 52,
  M: 12,
  Q: 4,
  A: 1,
};

/** Latest observation of a series, or null when empty. */
export function latest(observations: Observation[]): Observation | null {
  return observations.length > 0 ? observations[observations.length - 1] : null;
}

/** Observation `stepsBack` before the latest (1 = previous period). */
export function previous(
  observations: Observation[],
  stepsBack = 1,
): Observation | null {
  const index = observations.length - 1 - stepsBack;
  return index >= 0 ? observations[index] : null;
}

/**
 * Year-over-year percent change series: (X_t / X_{t-lag} − 1) × 100.
 * `lag` defaults to 12 (monthly series); pass 4 for quarterly.
 * Skips windows where the base observation is missing.
 */
export function yoyPercentChange(
  observations: Observation[],
  lag = 12,
): Observation[] {
  const result: Observation[] = [];
  for (let i = lag; i < observations.length; i += 1) {
    const [date, value] = observations[i];
    const [, base] = observations[i - lag];
    if (base !== 0) {
      result.push([date, (value / base - 1) * 100]);
    }
  }
  return result;
}

/** Period-over-period difference (e.g. monthly payroll change in thousands). */
export function periodChange(observations: Observation[]): Observation[] {
  const result: Observation[] = [];
  for (let i = 1; i < observations.length; i += 1) {
    result.push([observations[i][0], observations[i][1] - observations[i - 1][1]]);
  }
  return result;
}

/**
 * Percentile rank (0–100) of `value` within `values`: the share of
 * observations strictly below, plus half of exact ties (midrank convention).
 * Answers "how unusual is the latest reading?" without a good/bad judgment.
 */
export function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return NaN;
  let below = 0;
  let ties = 0;
  for (const v of values) {
    if (v < value) below += 1;
    else if (v === value) ties += 1;
  }
  return ((below + ties / 2) / values.length) * 100;
}

/**
 * Exact real growth rate from nominal growth and inflation (ratio form):
 * ((1 + g/100) / (1 + π/100) − 1) × 100. The g − π approximation is fine
 * for small rates but this form is used wherever compounding matters.
 */
export function realGrowthRate(nominalPct: number, inflationPct: number): number {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
}

/**
 * Purchasing power of `amount` after prices move from `cpiStart` to `cpiEnd`:
 * the constant-basket value of the same dollars at the new price level.
 */
export function purchasingPower(
  amount: number,
  cpiStart: number,
  cpiEnd: number,
): number {
  if (cpiEnd === 0) return NaN;
  return amount * (cpiStart / cpiEnd);
}

/**
 * Standard fixed-rate mortgage payment (principal & interest per month).
 * M = P · r(1+r)^n / ((1+r)^n − 1), r = annual rate / 12, n = months.
 * A 0% rate degenerates to simple division.
 */
export function monthlyMortgagePayment(
  principal: number,
  annualRatePct: number,
  years: number,
): number {
  const months = years * 12;
  if (months <= 0 || principal <= 0) return NaN;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  const growth = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * growth) / (growth - 1);
}

/**
 * EconOS Housing Affordability Index (docs/economic-methodology.md).
 * 100 = a median-income family exactly meets the 28% front-end ratio on the
 * median home with 20% down on a 30-year fixed loan. >100 = more affordable.
 */
export function housingAffordabilityIndex(
  medianPrice: number,
  medianAnnualIncome: number,
  mortgageRatePct: number,
  options: { downPaymentShare?: number; frontEndRatio?: number; termYears?: number } = {},
): number {
  const { downPaymentShare = 0.2, frontEndRatio = 0.28, termYears = 30 } = options;
  const loan = medianPrice * (1 - downPaymentShare);
  const payment = monthlyMortgagePayment(loan, mortgageRatePct, termYears);
  if (!Number.isFinite(payment) || payment <= 0) return NaN;
  const affordableMonthly = (medianAnnualIncome / 12) * frontEndRatio;
  return (affordableMonthly / payment) * 100;
}

/**
 * Labor-market tightness: vacancies per unemployed person (V/U).
 * Inputs are levels in the same unit (thousands of persons).
 */
export function vacancyUnemploymentRatio(
  jobOpenings: number,
  unemployedPersons: number,
): number {
  if (unemployedPersons === 0) return NaN;
  return jobOpenings / unemployedPersons;
}

/** Z-score of each value against the mean/stddev of the full array. */
export function zScores(values: number[]): number[] {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  return values.map((v) => (std === 0 ? 0 : (v - mean) / std));
}

/** Align two series on shared dates → [date, a, b]. Used for scatter views. */
export function alignSeries(
  a: Observation[],
  b: Observation[],
): Array<[string, number, number]> {
  const bByDate = new Map(b);
  const aligned: Array<[string, number, number]> = [];
  for (const [date, valueA] of a) {
    const valueB = bByDate.get(date);
    if (valueB !== undefined) aligned.push([date, valueA, valueB]);
  }
  return aligned;
}

/** Trim a series to observations on/after an ISO date. */
export function since(observations: Observation[], isoDate: string): Observation[] {
  return observations.filter(([date]) => date >= isoDate);
}

/**
 * Ordinary least squares on aligned pairs: y = a + b·x.
 * Returns slope, intercept, and R². Used for documented historical
 * associations (never presented as causal estimates).
 */
export function ols(pairs: Array<[number, number]>): {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
} {
  const n = pairs.length;
  if (n < 3) return { slope: NaN, intercept: NaN, r2: NaN, n };
  const meanX = pairs.reduce((s, [x]) => s + x, 0) / n;
  const meanY = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - meanX) * (y - meanY);
    sxx += (x - meanX) ** 2;
    syy += (y - meanY) ** 2;
  }
  if (sxx === 0 || syy === 0) return { slope: NaN, intercept: NaN, r2: NaN, n };
  const slope = sxy / sxx;
  return {
    slope,
    intercept: meanY - slope * meanX,
    r2: (sxy * sxy) / (sxx * syy),
    n,
  };
}
