import type { MetricCardProps } from "@/components/ui/MetricCard";
import { getSeries } from "@/lib/data";
import {
  alignSeries,
  latest,
  percentileRank,
  periodChange,
  previous,
  realGrowthRate,
  yoyPercentChange,
} from "@/lib/econ";
import {
  formatNumber,
  formatObservationDate,
  formatSigned,
} from "@/lib/format";
import type { Observation, SeriesSnapshot } from "@/lib/types";

/**
 * Overview scorecard assembly.
 *
 * This module turns raw series snapshots into fully formatted MetricCard
 * view-models, grouped into the four sections of the overview page. All
 * arithmetic on observations goes through lib/econ; all display formatting
 * goes through lib/format. The page component only renders.
 *
 * Data-vintage note: several monthly federal series legitimately skip
 * 2025-10 (missed releases during the funding lapse). yoyPercentChange
 * matches base observations by calendar date and drops windows whose exact
 * base month is missing, so no year-over-year figure here is ever computed
 * over a stretched window. periodChange remains consecutive-observation
 * arithmetic; the single Nov 2025 "previous month" comparison spans the gap
 * and is labeled by its observation dates.
 */

/** One scorecard entry: MetricCard props plus a stable React key. */
export interface OverviewMetric extends MetricCardProps {
  key: string;
}

/** A titled group of scorecard entries. */
export interface OverviewSection {
  heading: string;
  metrics: OverviewMetric[];
}

/** Direction of a change, for the card's arrow and (tone-gated) coloring. */
function direction(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

/**
 * Percentile-context line, e.g. "Higher than 72% of readings since 1948".
 * The start year comes from the first observation of the *transformed*
 * history — a YoY series starts one year after its underlying index — so the
 * claim always matches the values actually ranked.
 */
function percentileLine(history: Observation[], value: number): string {
  const rank = percentileRank(
    history.map(([, v]) => v),
    value,
  );
  const startYear = history[0][0].slice(0, 4);
  return `Higher than ${Math.round(rank)}% of readings since ${startYear}`;
}

interface BuildCardOptions {
  key: string;
  label: string;
  /** Snapshot providing provenance (source, id, URL, staleness). */
  snapshot: SeriesSnapshot;
  /** Full transformed history; the last entry is the headline value. */
  history: Observation[];
  unit: string;
  /** Formats the headline and previous values. */
  formatValue: (v: number) => string;
  /** Formats the latest-vs-previous delta for the change line. */
  formatDelta: (d: number) => string;
  /**
   * Change-coloring policy (docs/economic-methodology.md): "neutral" for
   * rates, prices, yields, and anything welfare-ambiguous; "goodUp" /
   * "goodDown" only where the sign is unambiguous in our framing.
   */
  tone?: MetricCardProps["tone"];
  definition: string;
  interpretation: string;
}

/** Assemble one MetricCard view-model from a transformed history. */
function buildCard(options: BuildCardOptions): OverviewMetric {
  const latestObs = latest(options.history);
  const prevObs = previous(options.history);
  // Fail the build loudly rather than render a card with fabricated numbers.
  if (!latestObs || !prevObs) {
    throw new Error(`Insufficient history for overview metric "${options.key}"`);
  }
  const [latestDate, latestValue] = latestObs;
  const [prevDate, prevValue] = prevObs;
  // Latest-vs-previous delta, computed through the library (period change of
  // the transformed history) so no arithmetic happens outside lib/econ.
  const deltaObs = latest(periodChange(options.history));
  const delta = deltaObs ? deltaObs[1] : 0;

  return {
    key: options.key,
    label: options.label,
    value: options.formatValue(latestValue),
    unit: options.unit,
    observationDate: formatObservationDate(latestDate, options.snapshot.frequency),
    change: { text: options.formatDelta(delta), direction: direction(delta) },
    tone: options.tone ?? "neutral",
    previousText: `Prev: ${options.formatValue(prevValue)} (${formatObservationDate(
      prevDate,
      options.snapshot.frequency,
    )})`,
    contextText: percentileLine(options.history, latestValue),
    definition: options.definition,
    interpretation: options.interpretation,
    snapshot: options.snapshot,
  };
}

/** Delta formatter for values measured in percent: "+0.3 pp". */
function ppDelta(decimals: number) {
  return (d: number) => `${formatSigned(d, decimals)} pp`;
}

/**
 * Build the four scorecard sections of the overview page.
 * Called once per build from the (statically generated) overview page.
 */
export function getOverviewSections(): OverviewSection[] {
  // --- Load every snapshot up front; getSeries caches per build. -----------
  const gdp = getSeries("real_gdp_growth");
  const industrialProduction = getSeries("industrial_production");
  const retailSales = getSeries("retail_sales");
  const sentiment = getSeries("consumer_sentiment");
  const cpiAll = getSeries("cpi_all");
  const cpiCore = getSeries("cpi_core");
  const earnings = getSeries("avg_hourly_earnings");
  const unemployment = getSeries("unemployment_rate");
  const payrolls = getSeries("payrolls");
  const participation = getSeries("participation_rate");
  const jobOpenings = getSeries("job_openings");
  const fedFunds = getSeries("fed_funds");
  const yieldSpread = getSeries("yield_spread_10y2y");
  const mortgage = getSeries("mortgage_30y");
  const housingStarts = getSeries("housing_starts");

  // --- Shared transformed histories. ---------------------------------------
  // CPI and earnings YoY are reused by the real-wage card, so compute once.
  const cpiAllYoY = yoyPercentChange(cpiAll.observations);
  const cpiCoreYoY = yoyPercentChange(cpiCore.observations);
  const earningsYoY = yoyPercentChange(earnings.observations);

  // Real wage growth: exact ratio form ((1+g)/(1+π) − 1), computed on months
  // where both the wage YoY and CPI YoY series have an observation. The
  // simple g − π difference overstates real growth when rates are large.
  const realWageHistory: Observation[] = alignSeries(earningsYoY, cpiAllYoY).map(
    ([date, wageGrowth, inflation]): Observation => [
      date,
      realGrowthRate(wageGrowth, inflation),
    ],
  );

  // Payroll history is the MoM change itself — that is the headline number
  // ("the economy added X thousand jobs"), not the ~159 million level.
  const payrollChanges = periodChange(payrolls.observations);

  return [
    {
      heading: "Growth & activity",
      metrics: [
        buildCard({
          key: "real-gdp-growth",
          label: "Real GDP growth",
          snapshot: gdp,
          // Published BEA rate — used directly, never recomputed from levels.
          history: gdp.observations,
          unit: "% SAAR",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: ppDelta(1),
          // Faster real output growth is unambiguously expansionary in our
          // framing, so this is one of the few goodUp cards.
          tone: "goodUp",
          definition:
            "Quarter-over-quarter growth in inflation-adjusted output, expressed as a seasonally adjusted annual rate, as published by the Bureau of Economic Analysis.",
          interpretation:
            "Readings near 2% are close to the U.S. long-run trend; quarterly prints are volatile and revised, so the direction over several quarters matters more than any single number.",
        }),
        buildCard({
          key: "industrial-production-yoy",
          label: "Industrial production",
          snapshot: industrialProduction,
          history: yoyPercentChange(industrialProduction.observations),
          unit: "% YoY",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: ppDelta(1),
          // Neutral: output growth interacts with capacity and price pressure,
          // so we do not color it as unambiguously good.
          definition:
            "Twelve-month percent change in the Federal Reserve's index of real output from manufacturing, mining, and electric and gas utilities.",
          interpretation:
            "Industry is a narrow but cyclically sensitive slice of the economy; growth near zero signals a flat goods sector even while services keep expanding.",
        }),
        buildCard({
          key: "retail-sales-yoy",
          label: "Retail sales",
          snapshot: retailSales,
          history: yoyPercentChange(retailSales.observations),
          unit: "% YoY",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: ppDelta(1),
          // Neutral: nominal sales rise with prices as well as volumes.
          definition:
            "Twelve-month percent change in nominal retail and food-services sales. Not adjusted for inflation.",
          interpretation:
            "Because sales are measured in current dollars, part of any increase is higher prices — compare against CPI inflation to judge real spending growth.",
        }),
        buildCard({
          key: "consumer-sentiment",
          label: "Consumer sentiment",
          snapshot: sentiment,
          history: sentiment.observations,
          unit: "index",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: (d) => `${formatSigned(d, 1)} pts`,
          definition:
            "University of Michigan index of how households assess their finances, buying conditions, and the economy (1966:Q1 = 100).",
          interpretation:
            "Sentiment can stay depressed on price levels and borrowing costs even when the labor market is firm, so read it alongside — not instead of — the hard data.",
        }),
      ],
    },
    {
      heading: "Prices & wages",
      metrics: [
        buildCard({
          key: "cpi-inflation",
          label: "CPI inflation",
          snapshot: cpiAll,
          history: cpiAllYoY,
          unit: "% YoY",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: ppDelta(1),
          // Neutral by policy: falling inflation is not unambiguously good —
          // it can reflect healthy disinflation or collapsing demand.
          definition:
            "Twelve-month percent change in the Consumer Price Index for All Urban Consumers, covering the full basket of goods and services.",
          interpretation:
            "The Federal Reserve's price-stability goal corresponds to roughly 2% inflation; whether a move up or down is welcome depends on why prices are changing.",
        }),
        buildCard({
          key: "core-cpi-inflation",
          label: "Core CPI inflation",
          snapshot: cpiCore,
          history: cpiCoreYoY,
          unit: "% YoY",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: ppDelta(1),
          definition:
            "Twelve-month percent change in the CPI excluding food and energy, whose prices swing with weather and world markets.",
          interpretation:
            "Core inflation is a cleaner read on the underlying trend; headline inflation tends to converge toward it once food and energy shocks pass through.",
        }),
        buildCard({
          key: "wage-growth",
          label: "Wage growth",
          snapshot: earnings,
          history: earningsYoY,
          unit: "% YoY",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: ppDelta(1),
          // Neutral: fast nominal wage growth is good for workers but can also
          // signal labor-cost pressure feeding back into prices.
          definition:
            "Twelve-month percent change in average hourly earnings of all private-sector employees, from the BLS establishment survey.",
          interpretation:
            "Nominal wage growth raises living standards only when it outpaces inflation; the real-wage card next to this one makes that comparison explicit.",
        }),
        buildCard({
          key: "real-wage-growth",
          label: "Real wage growth",
          // Derived from two series; provenance shows the wage side and the
          // definition names the CPI series used for the deflator.
          snapshot: earnings,
          history: realWageHistory,
          unit: "% YoY",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: ppDelta(1),
          // goodUp: rising purchasing power of labor income is unambiguous.
          tone: "goodUp",
          definition:
            "Average-hourly-earnings growth adjusted for CPI inflation using the exact ratio form ((1 + wage growth) ÷ (1 + inflation) − 1). Computed by EconOS from the BLS earnings and CPI series.",
          interpretation:
            "Positive readings mean the average paycheck buys more than a year ago; even small negative readings compound into lost purchasing power if they persist.",
        }),
      ],
    },
    {
      heading: "Labor",
      metrics: [
        buildCard({
          key: "unemployment-rate",
          label: "Unemployment rate",
          snapshot: unemployment,
          history: unemployment.observations,
          unit: "%",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: ppDelta(1),
          // goodDown: fewer people involuntarily out of work is unambiguous.
          tone: "goodDown",
          definition:
            "Share of the civilian labor force that is jobless, available to work, and actively searched for work in the prior four weeks (U-3).",
          interpretation:
            "Readings near 4% have historically indicated a labor market close to full employment; sustained rises of half a point or more have accompanied every postwar recession.",
        }),
        buildCard({
          key: "payroll-change",
          label: "Payroll change",
          snapshot: payrolls,
          history: payrollChanges,
          unit: "thousand jobs, MoM",
          formatValue: (v) => formatSigned(v, 0),
          formatDelta: (d) => `${formatSigned(d, 0)} vs prior month`,
          // goodUp: net job creation is unambiguously expansionary here.
          tone: "goodUp",
          definition:
            "Month-over-month change in total nonfarm payroll employment, from the BLS survey of employers.",
          interpretation:
            "Monthly gains of roughly 80–100 thousand are about what absorbs labor-force growth; single months are noisy and revised twice, so watch the three-month pace.",
        }),
        buildCard({
          key: "participation-rate",
          label: "Participation rate",
          snapshot: participation,
          history: participation.observations,
          unit: "%",
          formatValue: (v) => formatNumber(v, 1),
          formatDelta: ppDelta(1),
          // goodUp: more people engaged with the labor market is unambiguous
          // within our framing, holding demographics fixed month to month.
          tone: "goodUp",
          definition:
            "Share of the civilian population aged 16 and over that is either working or actively looking for work.",
          interpretation:
            "Participation drifts with demographics, but cyclical declines can flatter the unemployment rate — fewer people counted as searching means fewer counted as unemployed.",
        }),
        buildCard({
          key: "job-openings",
          label: "Job openings",
          snapshot: jobOpenings,
          history: jobOpenings.observations,
          unit: "thousands",
          formatValue: (v) => formatNumber(v, 0),
          formatDelta: (d) => formatSigned(d, 0),
          definition:
            "Job openings on the last business day of the month, from the BLS Job Openings and Labor Turnover Survey (JOLTS).",
          interpretation:
            "Openings measure labor demand; set against the number of unemployed people, a ratio near one opening per job seeker marks a roughly balanced market.",
        }),
      ],
    },
    {
      heading: "Rates & housing",
      metrics: [
        buildCard({
          key: "fed-funds",
          label: "Federal funds rate",
          snapshot: fedFunds,
          history: fedFunds.observations,
          unit: "%",
          formatValue: (v) => formatNumber(v, 2),
          formatDelta: ppDelta(2),
          // Neutral by policy: the "right" level of the policy rate depends
          // entirely on the state of inflation and employment.
          definition:
            "Monthly average of the effective federal funds rate — the overnight interbank rate the Federal Reserve steers as its primary policy instrument.",
          interpretation:
            "What matters for the economy is the real policy rate — nominal minus expected inflation — which is what actually restrains or stimulates demand.",
        }),
        buildCard({
          key: "yield-spread",
          label: "Yield curve (10y − 2y)",
          snapshot: yieldSpread,
          history: yieldSpread.observations,
          unit: "pp",
          formatValue: (v) => formatNumber(v, 2),
          formatDelta: ppDelta(2),
          definition:
            "Ten-year Treasury yield minus the two-year yield, in percentage points, at daily frequency.",
          interpretation:
            "An inverted (negative) curve has preceded most postwar recessions, but the lead time ranges from months to years and inversions can unwind without a downturn.",
        }),
        buildCard({
          key: "mortgage-30y",
          label: "30-year mortgage rate",
          snapshot: mortgage,
          history: mortgage.observations,
          unit: "%",
          formatValue: (v) => formatNumber(v, 2),
          formatDelta: ppDelta(2),
          definition:
            "Average contract rate on 30-year fixed-rate mortgages, from Freddie Mac's weekly survey of lenders.",
          interpretation:
            "Mortgage rates track long-term Treasury yields plus a spread; a single percentage point moves the monthly payment on a typical home by hundreds of dollars.",
        }),
        buildCard({
          key: "housing-starts",
          label: "Housing starts",
          snapshot: housingStarts,
          history: housingStarts.observations,
          unit: "thousands, SAAR",
          formatValue: (v) => formatNumber(v, 0),
          formatDelta: (d) => formatSigned(d, 0),
          // Neutral: more building eases future supply but monthly moves say
          // little about affordability today.
          definition:
            "New privately owned housing units on which construction started, expressed as a seasonally adjusted annual rate.",
          interpretation:
            "Starts are the supply pipeline for housing; monthly readings swing widely with weather and multifamily projects, so the trend matters more than any single month.",
        }),
      ],
    },
  ];
}
