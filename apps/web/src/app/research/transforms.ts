import { purchasingPower } from "@/lib/econ";
import type { Observation } from "@/lib/types";

/**
 * Route-local series transforms shared by the research modules and the
 * rate-transmission simulator (src/app/simulator/associations.ts imports from
 * here so the simulator's estimates and the research write-ups are computed
 * from literally the same code).
 *
 * Why these exist instead of index-based helpers in lib/econ: several monthly
 * snapshots legitimately skip 2025-10 (missed federal releases during the
 * fall 2025 funding lapse — cpi_all, unemployment_rate, unemployed_persons).
 * An index-based lag such as `observations[i - 12]` silently lands on the
 * wrong month once a gap exists, so every lag operation here is keyed by
 * calendar month and simply drops windows whose base month is absent. All
 * multi-step economic formulas still live in lib/econ; these helpers only do
 * frequency alignment and calendar-aware differencing.
 */

/** "YYYY-MM" month key from an ISO date. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Add `count` months (may be negative) to a "YYYY-MM" key. */
export function addMonths(yearMonth: string, count: number): string {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  const total = year * 12 + (month - 1) + count;
  const outYear = Math.floor(total / 12);
  const outMonth = (total % 12) + 1;
  return `${String(outYear).padStart(4, "0")}-${String(outMonth).padStart(2, "0")}`;
}

/**
 * Average a daily or weekly series into a monthly one (dated "YYYY-MM-01").
 * Used to put the weekly 30-year mortgage rate on the same calendar as the
 * monthly policy-rate and housing series before differencing. A simple
 * unweighted mean of the observations that fall inside each month — adequate
 * for rates, which move slowly relative to the month.
 */
export function monthlyAverage(observations: Observation[]): Observation[] {
  const sums = new Map<string, { total: number; count: number }>();
  for (const [date, value] of observations) {
    const key = monthKey(date);
    const entry = sums.get(key) ?? { total: 0, count: 0 };
    entry.total += value;
    entry.count += 1;
    sums.set(key, entry);
  }
  return [...sums.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, { total, count }]) => [`${key}-01`, total / count]);
}

/**
 * Average a monthly series into a quarterly one (dated at the quarter-start
 * month, matching how FRED dates quarterly series such as real_gdp_growth).
 * Quarters containing the missing 2025-10 month are averaged over the two
 * available months — a documented approximation, not silently exact.
 */
export function quarterlyAverage(observations: Observation[]): Observation[] {
  const sums = new Map<string, { total: number; count: number }>();
  for (const [date, value] of observations) {
    const year = date.slice(0, 4);
    const month = Number(date.slice(5, 7));
    const quarterStart = String((Math.floor((month - 1) / 3) * 3 + 1)).padStart(2, "0");
    const key = `${year}-${quarterStart}`;
    const entry = sums.get(key) ?? { total: 0, count: 0 };
    entry.total += value;
    entry.count += 1;
    sums.set(key, entry);
  }
  return [...sums.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, { total, count }]) => [`${key}-01`, total / count]);
}

/**
 * Calendar-aware difference over `months`: X_t − X_{t−months}, in the
 * series' own units (percentage points for a rate series). Windows whose
 * base month is missing are dropped rather than misaligned.
 */
export function changeOverMonths(
  observations: Observation[],
  months: number,
): Observation[] {
  const byMonth = new Map(observations.map(([date, value]) => [monthKey(date), value]));
  const result: Observation[] = [];
  for (const [date, value] of observations) {
    const base = byMonth.get(addMonths(monthKey(date), -months));
    if (base !== undefined) result.push([date, value - base]);
  }
  return result;
}

/**
 * Calendar-aware percent change over `months`: (X_t / X_{t−months} − 1) × 100.
 * The gap-robust counterpart of econ.yoyPercentChange (which lags by array
 * index and therefore mis-pairs months after the 2025-10 gap).
 */
export function percentChangeOverMonths(
  observations: Observation[],
  months: number,
): Observation[] {
  const byMonth = new Map(observations.map(([date, value]) => [monthKey(date), value]));
  const result: Observation[] = [];
  for (const [date, value] of observations) {
    const base = byMonth.get(addMonths(monthKey(date), -months));
    if (base !== undefined && base !== 0) {
      result.push([date, (value / base - 1) * 100]);
    }
  }
  return result;
}

/** A dated regression pair: outcome y at `date`, driver x at `date − lag`. */
export interface LaggedPair {
  date: string;
  x: number;
  y: number;
}

/**
 * Pair an outcome series with a driver series observed `lagMonths` earlier:
 * y_t matched with x_{t−lag}. This is how "transmission takes time" enters
 * the estimation — e.g. housing starts respond to the mortgage-rate change
 * builders and buyers saw about six months before, not the contemporaneous
 * one. Pairs are dated by the outcome month; unmatched months are dropped.
 */
export function laggedPairs(
  driver: Observation[],
  outcome: Observation[],
  lagMonths: number,
): LaggedPair[] {
  const driverByMonth = new Map(driver.map(([date, value]) => [monthKey(date), value]));
  const pairs: LaggedPair[] = [];
  for (const [date, y] of outcome) {
    const x = driverByMonth.get(addMonths(monthKey(date), -lagMonths));
    if (x !== undefined) pairs.push({ date, x, y });
  }
  return pairs;
}

/**
 * Cumulative real (inflation-adjusted) index of a nominal series against a
 * price level, normalized to 100 at the first shared date. Each point is the
 * nominal value deflated to base-period dollars via econ.purchasingPower,
 * then expressed relative to the base-period nominal value.
 */
export function cumulativeRealIndex(
  nominal: Observation[],
  priceLevel: Observation[],
): Observation[] {
  const priceByMonth = new Map(priceLevel.map(([date, value]) => [monthKey(date), value]));
  const result: Observation[] = [];
  let baseNominal: number | null = null;
  let basePrice: number | null = null;
  for (const [date, value] of nominal) {
    const price = priceByMonth.get(monthKey(date));
    if (price === undefined) continue;
    if (baseNominal === null || basePrice === null) {
      baseNominal = value;
      basePrice = price;
    }
    // Nominal dollars deflated to base-period purchasing power, as an index.
    const realValue = purchasingPower(value, basePrice, price);
    result.push([date, (realValue / baseNominal) * 100]);
  }
  return result;
}
