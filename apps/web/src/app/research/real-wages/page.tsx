import type { Metadata } from "next";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { Provenance } from "@/components/ui/Provenance";
import { getSeries } from "@/lib/data";
import { alignSeries, realGrowthRate, since } from "@/lib/econ";
import { formatMonth, formatPercent } from "@/lib/format";
import type { Observation } from "@/lib/types";
import { FindingStats, ModuleSection, ReproduceSection } from "../module-sections";
import { cumulativeRealIndex, percentChangeOverMonths } from "../transforms";

/**
 * /research/real-wages — Have wages kept up with prices?
 *
 * The core distinction is nominal versus real: a raise that trails inflation
 * is a pay cut in purchasing power, even though the paycheck number grew
 * (“money illusion”). This module computes year-over-year growth in average
 * hourly earnings and CPI-U, deflates one by the other with the exact ratio
 * form (econ.realGrowthRate), and tracks a cumulative real wage index from
 * the start of the earnings series.
 */

export const metadata: Metadata = {
  title: "Real wages · Research",
  description:
    "Have wages kept up with prices? Year-over-year earnings growth versus CPI inflation, the 2021–23 real-wage squeeze, and the cumulative real wage record since 2006.",
};

/** A run of consecutive negative values in a series. */
interface NegativeRun {
  startDate: string;
  endDate: string;
  months: number;
  troughDate: string;
  troughValue: number;
}

/**
 * Longest consecutive stretch of negative values — used to measure the
 * inflation squeeze: how long real wage growth stayed below zero and how
 * deep it got. Selection logic only; the values were computed upstream.
 */
function longestNegativeRun(observations: Observation[]): NegativeRun | null {
  let best: NegativeRun | null = null;
  let current: NegativeRun | null = null;
  for (const [date, value] of observations) {
    if (value < 0) {
      if (current === null) {
        current = { startDate: date, endDate: date, months: 1, troughDate: date, troughValue: value };
      } else {
        current.endDate = date;
        current.months += 1;
        if (value < current.troughValue) {
          current.troughValue = value;
          current.troughDate = date;
        }
      }
      if (best === null || current.months > best.months) best = { ...current };
    } else {
      current = null;
    }
  }
  return best;
}

export default function RealWagesPage() {
  const earnings = getSeries("avg_hourly_earnings");
  const cpi = getSeries("cpi_all");

  // Year-over-year growth, calendar-keyed so the 2025-10 CPI gap drops the
  // affected windows instead of mis-pairing months.
  const wageGrowth = percentChangeOverMonths(earnings.observations, 12);
  const inflation = percentChangeOverMonths(cpi.observations, 12);

  // Real wage growth per month via the exact ratio form (not the g − π
  // approximation, which overstates real gains when inflation is high).
  const realWageGrowth: Observation[] = alignSeries(wageGrowth, inflation).map(
    ([date, nominal, priceGrowth]) => [date, realGrowthRate(nominal, priceGrowth)],
  );

  // Cumulative real wage index, 100 at the start of the earnings series
  // (March 2006) — the "has it kept up over the long run" view.
  const realIndex = cumulativeRealIndex(earnings.observations, cpi.observations);

  const seriesStart = earnings.observations[0][0];
  const latestReal = realWageGrowth[realWageGrowth.length - 1];
  const latestIndex = realIndex[realIndex.length - 1];
  const squeeze = longestNegativeRun(since(realWageGrowth, "2020-01-01"));

  // Inflation trimmed to the wage-growth window for the comparison chart.
  const inflationSinceWages = since(inflation, wageGrowth[0][0]);

  return (
    <div className="pb-16">
      <PageHeader
        question="Have wages kept up with prices?"
        title="Real wages"
        lede="A raise only makes a household better off if it outruns inflation. This module deflates average hourly earnings by consumer prices to separate the paycheck number from what it buys."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ModuleSection title="Question">
          <p>
            Have American wages kept up with prices — month to month through the recent
            inflation, and cumulatively over the past two decades?
          </p>
        </ModuleSection>

        <ModuleSection title="Theory">
          <p>
            The real wage is the nominal wage divided by the price level: what an hour of work
            buys, not what it pays. Standard theory ties long-run real wages to productivity,
            while in the short run nominal wages adjust slowly — so an inflation surprise cuts
            real wages first and wage catch-up comes later, if at all. The gap between the two
            matters because people often reason in nominal terms (“money illusion”): a 5% raise
            during 8% inflation feels like a gain but is a roughly 3% pay cut in purchasing
            power.
          </p>
        </ModuleSection>

        <ModuleSection title="Data">
          <p>
            Average hourly earnings of private-sector employees (monthly, from{" "}
            {formatMonth(seriesStart)}) and the consumer price index for all urban consumers
            (CPI-U, monthly). Both are national, seasonally adjusted series; several monthly
            snapshots legitimately skip October 2025 because of missed federal releases, and
            every 12-month comparison here is calendar-keyed so those windows are dropped
            rather than misaligned.
          </p>
          <div className="space-y-1">
            <Provenance snapshot={earnings} />
            <Provenance snapshot={cpi} />
          </div>
        </ModuleSection>

        <ModuleSection title="Method">
          <p>
            Year-over-year percent change is computed for both series; monthly real wage
            growth uses the exact ratio form ((1 + g/100) / (1 + π/100) − 1) × 100 rather than
            the g − π shortcut, which overstates real gains when inflation is high. The
            cumulative index deflates each month&rsquo;s nominal wage to{" "}
            {formatMonth(seriesStart)} dollars and normalizes the series to 100 at that base,
            so any point reads directly as purchasing power relative to the start.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <TimeSeriesChart
              title="Nominal wage growth vs. inflation"
              subtitle="Year-over-year percent change, monthly"
              unit="% YoY"
              sourceLine="BLS Average Hourly Earnings & CPI-U via FRED"
              description="Line chart comparing year-over-year growth in average hourly earnings with CPI inflation since 2007. Inflation runs above wage growth from mid-2021 through early 2023; the lines converge near 3.5 percent by 2026."
              series={[
                { name: "Avg. hourly earnings", data: wageGrowth, color: "1" },
                { name: "CPI-U inflation", data: inflationSinceWages, color: "2" },
              ]}
              zeroLine
            />
            <TimeSeriesChart
              title="Cumulative real wage index"
              subtitle={`Inflation-adjusted average hourly earnings, ${formatMonth(seriesStart)} = 100`}
              unit="index"
              sourceLine="BLS via FRED; EconOS calculation"
              description="Line chart of inflation-adjusted average hourly earnings indexed to 100 in March 2006, rising to the low 110s by 2026 with a pandemic-era spike and a 2021 to 2023 decline."
              series={[{ name: "Real wage index", data: realIndex, color: "1" }]}
            />
          </div>
        </ModuleSection>

        <ModuleSection title="Findings">
          <div>
            <FindingStats
              items={[
                {
                  label: "Real wage growth now",
                  value: latestReal ? formatPercent(latestReal[1], 1, true) : "—",
                  detail: latestReal
                    ? `Year over year as of ${formatMonth(latestReal[0])} — nominal gains and inflation are nearly offsetting.`
                    : "Computed at build time.",
                },
                {
                  label: "The inflation squeeze",
                  value: squeeze ? `${squeeze.months} months` : "—",
                  detail: squeeze
                    ? `Real wage growth stayed negative from ${formatMonth(squeeze.startDate)} to ${formatMonth(squeeze.endDate)}, bottoming at ${formatPercent(squeeze.troughValue, 1)} (${formatMonth(squeeze.troughDate)}).`
                    : "No sustained negative stretch in the sample.",
                },
                {
                  label: `Cumulative real gain since ${formatMonth(seriesStart)}`,
                  value: latestIndex ? formatPercent(latestIndex[1] - 100, 1, true) : "—",
                  detail: latestIndex
                    ? `The average hour of work buys ${formatPercent(latestIndex[1] - 100, 1)} more than at the series start (as of ${formatMonth(latestIndex[0])}).`
                    : "Computed at build time.",
                },
              ]}
            />
          </div>
          <p>
            The answer is: mostly, eventually — with a long detour. Wages roughly tracked
            prices before the pandemic, real pay then spiked and slumped through 2020–21 as
            the workforce&rsquo;s composition shifted, and the 2021–23 inflation put real wage
            growth below zero for about two years before nominal wage gains finally caught
            back up. The cumulative index shows the average real wage modestly above its
            2006 starting point — growth, but far short of what sustained productivity gains
            might have delivered.
          </p>
        </ModuleSection>

        <ModuleSection title="Uncertainty">
          <p>
            Every number above depends on which wage and price measures are used. CPI-U tends
            to run a few tenths above the PCE deflator, so “real” growth deflated by CPI is
            the more pessimistic reading; alternative wage series (median usual weekly
            earnings, the employment cost index) date the squeeze differently. The dashed
            boundary dates of the squeeze move by a month or two under small revisions to
            either input series — treat its length as “about two years,” not exactly{" "}
            {squeeze ? `${squeeze.months}` : "25"} months.
          </p>
        </ModuleSection>

        <ModuleSection title="Limitations">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-ink">Composition effects.</span> Average
              hourly earnings is a ratio of total pay to total hours, so the 2020 layoffs —
              concentrated among lower-paid workers — mechanically raised the average without
              anyone getting a raise, and rehiring later reversed it. The pandemic-era spike
              and part of the 2021 “decline” are workforce-mix artifacts, not wage changes.
            </li>
            <li>
              <span className="font-medium text-ink">Average ≠ median.</span> The mean is
              pulled by high earners; median and distributional measures can tell a different
              story about the typical worker.
            </li>
            <li>
              <span className="font-medium text-ink">One national price index.</span> CPI-U is
              a national urban average; households with different consumption baskets —
              renters, drivers, regions with fast shelter inflation — experienced different
              real wage paths.
            </li>
          </ul>
        </ModuleSection>

        <ReproduceSection modulePath="apps/web/src/app/research/real-wages/page.tsx" />
      </div>
    </div>
  );
}
