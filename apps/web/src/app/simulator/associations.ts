import { getSeries } from "@/lib/data";
import { ols } from "@/lib/econ";
import type { Observation } from "@/lib/types";
import {
  changeOverMonths,
  laggedPairs,
  monthlyAverage,
  percentChangeOverMonths,
} from "@/app/research/transforms";

/**
 * Historical associations behind the Interest-Rate Transmission Simulator.
 *
 * Everything here is estimated at build time from the committed data
 * snapshots — no request-time work, no hand-typed coefficients. Each estimate
 * is a simple two-variable OLS on 12-month changes since 1990, with the lag
 * structure documented per relationship. The transforms are shared with the
 * research modules (src/app/research/transforms.ts), so the numbers shown on
 * /simulator and /research/rate-transmission are computed by the same code.
 *
 * Two honesty rules govern how these are presented:
 *
 * 1. These are ASSOCIATIONS, not causal effects. Monetary policy is
 *    endogenous: the Fed moves rates in response to the same conditions that
 *    move housing and spending, so a regression of outcomes on rate changes
 *    mixes the effect of policy with the conditions policy was reacting to.
 *
 * 2. The displayed range (0.5× to 1.5× the point estimate) is a JUDGMENT
 *    OVERLAY, not a confidence interval. It is deliberately wide to signal
 *    that a two-variable regression over one historical window cannot pin
 *    down a structural parameter; several fits below have very low R², and
 *    the range is how that uncertainty stays visible in the UI.
 */

/** Estimation window start: modern policy-communication era. */
const WINDOW_START = "1990-01";

/** Human-readable window label shown wherever an estimate appears. */
const WINDOW_LABEL = "1990–2026";

/** One estimated relationship, fully serializable for the client simulator. */
export interface Association {
  /** Stable identifier, e.g. "housing_starts". */
  id: string;
  /** Short display name of the outcome, e.g. "Housing starts". */
  outcome: string;
  /** What the outcome is regressed on. */
  driver: string;
  /** Prose relationship line for the provenance table. */
  relationship: string;
  /** OLS slope: outcome units per 1pp change in the driver. */
  slope: number;
  /** Judgment-overlay range bounds: 0.5× and 1.5× the slope. */
  slopeLow: number;
  slopeHigh: number;
  intercept: number;
  r2: number;
  n: number;
  /** Estimation window label, e.g. "1990–2026". */
  window: string;
  /** Months the driver is lagged behind the outcome (0 = contemporaneous). */
  lagMonths: number;
  /** Display unit of the slope, e.g. "pp per pp" or "% per pp". */
  slopeUnit: string;
}

/** The full set of estimated relationships passed to the client simulator. */
export interface TransmissionAssociations {
  passThrough: Association;
  housingStarts: Association;
  newHomeSales: Association;
  constructionEmployment: Association;
  durables: Association;
}

/** Restrict lagged pairs to outcomes dated on/after the estimation window. */
function pairsSince(
  driver: Observation[],
  outcome: Observation[],
  lagMonths: number,
): Array<[number, number]> {
  return laggedPairs(driver, outcome, lagMonths)
    .filter(({ date }) => date.slice(0, 7) >= WINDOW_START)
    .map(({ x, y }): [number, number] => [x, y]);
}

/** Wrap an OLS fit with its provenance metadata and judgment range. */
function makeAssociation(
  meta: Pick<Association, "id" | "outcome" | "driver" | "relationship" | "lagMonths" | "slopeUnit">,
  fit: ReturnType<typeof ols>,
): Association {
  return {
    ...meta,
    slope: fit.slope,
    // Judgment overlay: half to one-and-a-half times the point estimate.
    // For negative slopes "low" is the smaller magnitude — callers should
    // treat [slopeLow, slopeHigh] as an unordered pair and sort for display.
    slopeLow: fit.slope * 0.5,
    slopeHigh: fit.slope * 1.5,
    intercept: fit.intercept,
    r2: fit.r2,
    n: fit.n,
    window: WINDOW_LABEL,
  };
}

/**
 * Estimate all five relationships. Runs once per build (module scope in the
 * importing server pages); the result is a plain serializable object.
 */
function estimateAssociations(): TransmissionAssociations {
  // Drivers. The weekly mortgage series is averaged to monthly first so all
  // differencing happens on one calendar.
  const fedFunds = getSeries("fed_funds").observations;
  const mortgageMonthly = monthlyAverage(getSeries("mortgage_30y").observations);
  const fedFundsChange12 = changeOverMonths(fedFunds, 12); // pp over 12 months
  const mortgageChange12 = changeOverMonths(mortgageMonthly, 12); // pp over 12 months

  // (1) Mortgage pass-through: how much of a 12-month change in the policy
  // rate shows up in the 30-year mortgage rate over the same 12 months.
  // Contemporaneous (lag 0): mortgage rates reprice off expectations quickly,
  // often moving before the policy rate itself.
  const passThrough = makeAssociation(
    {
      id: "pass_through",
      outcome: "30-year mortgage rate",
      driver: "12-month change in the federal funds rate",
      relationship: "12m change in 30-year mortgage rate on 12m change in federal funds rate",
      lagMonths: 0,
      slopeUnit: "pp per pp",
    },
    ols(pairsSince(fedFundsChange12, mortgageChange12, 0)),
  );

  // (2) Housing starts: 12-month % change regressed on the 12-month
  // mortgage-rate change observed 6 months earlier. The lag is there because
  // transmission takes time — buyers re-run affordability math, builders
  // adjust land purchases and permit filings, and only then do foundations
  // get poured. Contemporaneous fits mostly capture reverse timing.
  const startsGrowth = percentChangeOverMonths(getSeries("housing_starts").observations, 12);
  const housingStarts = makeAssociation(
    {
      id: "housing_starts",
      outcome: "Housing starts",
      driver: "12-month mortgage-rate change, 6 months earlier",
      relationship: "12m % change in housing starts on 12m mortgage-rate change (lagged 6m)",
      lagMonths: 6,
      slopeUnit: "% per pp",
    },
    ols(pairsSince(mortgageChange12, startsGrowth, 6)),
  );

  // (3) New single-family home sales: same design as starts — sales respond
  // to the financing conditions shoppers faced when they started searching.
  const salesGrowth = percentChangeOverMonths(getSeries("new_home_sales").observations, 12);
  const newHomeSales = makeAssociation(
    {
      id: "new_home_sales",
      outcome: "New single-family home sales",
      driver: "12-month mortgage-rate change, 6 months earlier",
      relationship: "12m % change in new home sales on 12m mortgage-rate change (lagged 6m)",
      lagMonths: 6,
      slopeUnit: "% per pp",
    },
    ols(pairsSince(mortgageChange12, salesGrowth, 6)),
  );

  // (4) Construction employment: 12-month lag — hiring follows the pipeline
  // of projects started under earlier financing conditions, so employment is
  // the slowest link in the chain.
  const constructionGrowth = percentChangeOverMonths(
    getSeries("construction_employment").observations,
    12,
  );
  const constructionEmployment = makeAssociation(
    {
      id: "construction_employment",
      outcome: "Construction employment",
      driver: "12-month mortgage-rate change, 12 months earlier",
      relationship: "12m % change in construction employment on 12m mortgage-rate change (lagged 12m)",
      lagMonths: 12,
      slopeUnit: "% per pp",
    },
    ols(pairsSince(mortgageChange12, constructionGrowth, 12)),
  );

  // (5) Durable-goods spending: big-ticket purchases are the classic
  // interest-sensitive spending category; regressed on the policy-rate
  // change 6 months earlier (financing terms filter through to auto loans
  // and store credit with a shorter lag than housing construction).
  const durablesGrowth = percentChangeOverMonths(getSeries("pce_durables").observations, 12);
  const durables = makeAssociation(
    {
      id: "durables",
      outcome: "Durable-goods spending",
      driver: "12-month federal-funds change, 6 months earlier",
      relationship: "12m % change in durable-goods spending on 12m fed-funds change (lagged 6m)",
      lagMonths: 6,
      slopeUnit: "% per pp",
    },
    ols(pairsSince(fedFundsChange12, durablesGrowth, 6)),
  );

  return { passThrough, housingStarts, newHomeSales, constructionEmployment, durables };
}

/**
 * The estimated associations, computed once at module scope during the
 * build. Server pages import this and pass it (or slices of it) as plain
 * props to client components.
 */
export const transmissionAssociations: TransmissionAssociations = estimateAssociations();
