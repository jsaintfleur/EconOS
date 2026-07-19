import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { getSeries } from "@/lib/data";
import {
  latest,
  percentileRank,
  previous,
  realGrowthRate,
  since,
  yoyPercentChange,
} from "@/lib/econ";
import { formatMonth, formatNumber, formatPercent, formatSigned } from "@/lib/format";
import type { Observation } from "@/lib/types";
import { PurchasingPowerCalculator } from "./PurchasingPowerCalculator";

export const metadata: Metadata = {
  title: "Inflation",
  description:
    "Headline and core CPI inflation, category-level price changes, wage growth versus prices, and a purchasing-power calculator built on BLS CPI-U data.",
};

/* ------------------------------------------------------------------ */
/* Small page-local helpers (presentation glue only — every substantive
   series transformation goes through lib/econ).                       */
/* ------------------------------------------------------------------ */

/** Arrow direction from the sign of a change. */
function direction(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

/** English ordinal ("1st", "22nd", "62nd", "111th") for percentile lines. */
function ordinal(value: number): string {
  const n = Math.round(value);
  const rem100 = n % 100;
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const suffix = rem100 >= 11 && rem100 <= 13 ? "th" : (suffixes[n % 10] ?? "th");
  return `${n}${suffix}`;
}

/**
 * Value of a series exactly twelve months before `latestDate`, matched by
 * date rather than by array position. Position-based lookups (index − 12)
 * would silently misalign when a month is missing — several 2025 federal
 * releases were skipped — so we build the target ISO date and search for it.
 */
function valueOneYearEarlier(
  observations: Observation[],
  latestDate: string,
): number | null {
  const target = `${Number(latestDate.slice(0, 4)) - 1}${latestDate.slice(4)}`;
  const hit = observations.find(([date]) => date === target);
  return hit ? hit[1] : null;
}

/** Unweighted mean — used only for annual-average CPI (the BLS convention). */
function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Contiguous stretches where a series is negative, with a rough length in
 * periods. Used to derive — not hardcode — when real wages were falling.
 */
function negativeSpells(
  observations: Observation[],
): Array<{ start: string; end: string; length: number }> {
  const spells: Array<{ start: string; end: string; length: number }> = [];
  let open: { start: string; end: string; length: number } | null = null;
  for (const [date, value] of observations) {
    if (value < 0) {
      if (open) {
        open.end = date;
        open.length += 1;
      } else {
        open = { start: date, end: date, length: 1 };
      }
    } else if (open) {
      spells.push(open);
      open = null;
    }
  }
  if (open) spells.push(open);
  return spells;
}

export default function InflationPage() {
  /* -------------------------------------------------------------- */
  /* Data. All CPI series are seasonally adjusted monthly indexes;   */
  /* inflation is always computed here as year-over-year % change,   */
  /* which avoids the noise of month-over-month annualization.       */
  /* -------------------------------------------------------------- */
  const cpiAll = getSeries("cpi_all");
  const cpiCore = getSeries("cpi_core");
  const wages = getSeries("avg_hourly_earnings");

  const headlineYoY = yoyPercentChange(cpiAll.observations);
  const coreYoY = yoyPercentChange(cpiCore.observations);
  const wageYoY = yoyPercentChange(wages.observations);

  /* Headline card values. */
  const headlineLatest = latest(headlineYoY)!;
  const headlinePrev = previous(headlineYoY)!;
  const coreLatest = latest(coreYoY)!;
  const corePrev = previous(coreYoY)!;
  const wageLatest = latest(wageYoY)!;
  const wagePrev = previous(wageYoY)!;

  /*
   * Real wage growth: nominal wage growth deflated by headline inflation
   * using the exact ratio form (1+g)/(1+π) − 1, not the g − π shortcut.
   * The two YoY series are joined by date so a missing month in either
   * source never pairs mismatched periods.
   */
  const headlineByDate = new Map(headlineYoY);
  const realWageYoY: Observation[] = [];
  for (const [date, wageGrowth] of wageYoY) {
    const inflation = headlineByDate.get(date);
    if (inflation !== undefined) {
      realWageYoY.push([date, realGrowthRate(wageGrowth, inflation)]);
    }
  }
  const realWageLatest = latest(realWageYoY)!;
  const realWagePrev = previous(realWageYoY)!;

  /* Percentile context: where does the latest reading sit in each series'
     full published history? A neutral way to say "high" or "low". */
  const headlinePct = percentileRank(headlineYoY.map(([, v]) => v), headlineLatest[1]);
  const corePct = percentileRank(coreYoY.map(([, v]) => v), coreLatest[1]);
  const wagePct = percentileRank(wageYoY.map(([, v]) => v), wageLatest[1]);
  const realWagePct = percentileRank(realWageYoY.map(([, v]) => v), realWageLatest[1]);
  const headlineStartYear = headlineYoY[0][0].slice(0, 4);
  const wageStartYear = wageYoY[0][0].slice(0, 4);

  /* -------------------------------------------------------------- */
  /* Category breakdown: YoY inflation by CPI component, latest vs   */
  /* the same month one year earlier, sorted fastest-rising first.   */
  /* -------------------------------------------------------------- */
  const categorySeries = [
    { label: "Food", snapshot: getSeries("cpi_food") },
    { label: "Energy", snapshot: getSeries("cpi_energy") },
    { label: "Shelter", snapshot: getSeries("cpi_shelter") },
    { label: "Rent of primary residence", snapshot: getSeries("rent_primary_residence") },
    { label: "Medical care", snapshot: getSeries("cpi_medical") },
  ];
  const categoryRows = categorySeries
    .map(({ label, snapshot }) => {
      const yoy = yoyPercentChange(snapshot.observations);
      const nowObs = latest(yoy)!;
      const yearAgo = valueOneYearEarlier(yoy, nowObs[0]);
      /* Normalize deltas that round to zero at display precision so the
         table never shows a confusing "-0.0". */
      const rawDelta = yearAgo === null ? null : nowObs[1] - yearAgo;
      return {
        label,
        id: snapshot.id,
        asOf: nowObs[0],
        now: nowObs[1],
        yearAgo,
        delta: rawDelta !== null && Math.abs(rawDelta) < 0.05 ? 0 : rawDelta,
      };
    })
    .sort((a, b) => b.now - a.now);

  /* -------------------------------------------------------------- */
  /* Wages vs prices since 2016, and the derived real-wage story.    */
  /* Crossing dates come from the data: we find the stretches where  */
  /* real wage growth was negative rather than hardcoding episodes.  */
  /* -------------------------------------------------------------- */
  const wageYoYSince2016 = since(wageYoY, "2016-01-01");
  const headlineYoYSince2016 = since(headlineYoY, "2016-01-01");
  const realWageSince2016 = since(realWageYoY, "2016-01-01");
  const spells = negativeSpells(realWageSince2016).filter((s) => s.length >= 3);
  const mainSpell = spells.reduce<(typeof spells)[number] | null>(
    (longest, s) => (longest === null || s.length > longest.length ? s : longest),
    null,
  );

  /* -------------------------------------------------------------- */
  /* Purchasing-power calculator inputs: annual-average CPI for each */
  /* start year (the mean of that year's twelve monthly index values */
  /* — the same convention BLS uses for annual tables) plus the      */
  /* latest monthly index as "today".                                */
  /* -------------------------------------------------------------- */
  const cpiLatestObs = latest(cpiAll.observations)!;
  const calculatorYears = Array.from({ length: 10 }, (_, i) => 2015 + i).map((year) => ({
    year,
    avgCpi:
      mean(
        cpiAll.observations
          .filter(([date]) => date.startsWith(String(year)))
          .map(([, v]) => v),
      ),
  }));

  return (
    <>
      <PageHeader
        question="How fast are prices rising — and who feels it?"
        title="Inflation"
        lede="Headline and core consumer prices, what is driving them at the category level, and whether paychecks are keeping up — all computed from BLS CPI-U and payroll-survey data."
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* ---------------- Scorecard ---------------- */}
        <section aria-label="Inflation scorecard" className="mt-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Headline CPI inflation"
              value={formatNumber(headlineLatest[1], 1)}
              unit="% YoY"
              observationDate={formatMonth(headlineLatest[0])}
              change={{
                text: `${formatSigned(headlineLatest[1] - headlinePrev[1], 1)} pp`,
                direction: direction(headlineLatest[1] - headlinePrev[1]),
              }}
              tone="neutral"
              previousText={`${formatNumber(headlinePrev[1], 1)}% in ${formatMonth(headlinePrev[0])}`}
              contextText={`${ordinal(headlinePct)} percentile of all readings since ${headlineStartYear}`}
              definition="Year-over-year percent change in the Consumer Price Index for All Urban Consumers (CPI-U), all items, seasonally adjusted."
              interpretation="The broadest gauge of the cost of living. It includes volatile food and energy prices, so single readings can swing on commodity moves."
              snapshot={cpiAll}
            />
            <MetricCard
              label="Core CPI inflation"
              value={formatNumber(coreLatest[1], 1)}
              unit="% YoY"
              observationDate={formatMonth(coreLatest[0])}
              change={{
                text: `${formatSigned(coreLatest[1] - corePrev[1], 1)} pp`,
                direction: direction(coreLatest[1] - corePrev[1]),
              }}
              tone="neutral"
              previousText={`${formatNumber(corePrev[1], 1)}% in ${formatMonth(corePrev[0])}`}
              contextText={`${ordinal(corePct)} percentile of all readings since ${coreYoY[0][0].slice(0, 4)}`}
              definition="CPI-U excluding food and energy, year over year. Strips out the two most volatile categories to expose the underlying trend."
              interpretation="The measure policymakers watch for persistence. When core runs above headline, the volatile categories are masking, not driving, inflation."
              snapshot={cpiCore}
            />
            <MetricCard
              label="Wage growth"
              value={formatNumber(wageLatest[1], 1)}
              unit="% YoY"
              observationDate={formatMonth(wageLatest[0])}
              change={{
                text: `${formatSigned(wageLatest[1] - wagePrev[1], 1)} pp`,
                direction: direction(wageLatest[1] - wagePrev[1]),
              }}
              tone="neutral"
              previousText={`${formatNumber(wagePrev[1], 1)}% in ${formatMonth(wagePrev[0])}`}
              contextText={`${ordinal(wagePct)} percentile of readings since ${wageStartYear}`}
              definition="Year-over-year growth in average hourly earnings of all private-sector employees, from the BLS payroll survey."
              interpretation="Nominal pay growth in dollars. On its own it says nothing about living standards — it has to be compared against inflation, which the next card does."
              snapshot={wages}
            />
            <MetricCard
              label="Real wage growth"
              value={formatNumber(realWageLatest[1], 1)}
              unit="% YoY"
              observationDate={formatMonth(realWageLatest[0])}
              change={{
                text: `${formatSigned(realWageLatest[1] - realWagePrev[1], 1)} pp`,
                direction: direction(realWageLatest[1] - realWagePrev[1]),
              }}
              tone="goodUp"
              previousText={`${formatNumber(realWagePrev[1], 1)}% in ${formatMonth(realWagePrev[0])}`}
              contextText={`${ordinal(realWagePct)} percentile since ${realWageYoY[0][0].slice(0, 4)} (derived series)`}
              definition="Wage growth deflated by headline CPI inflation using the exact ratio form (1 + wage growth) ÷ (1 + inflation) − 1, not the subtraction shortcut."
              interpretation="The purchasing-power test: positive means the average paycheck buys more than a year ago; negative means prices are outrunning pay."
              snapshot={wages}
            />
          </div>
        </section>

        {/* ---------------- Headline vs core ---------------- */}
        <section aria-label="Headline versus core inflation" className="mt-12">
          <TimeSeriesChart
            title="Headline vs. core CPI inflation"
            subtitle="Year-over-year percent change, monthly, since 2000"
            unit="% YoY"
            sourceLine="U.S. Bureau of Labor Statistics via FRED (CPIAUCSL, CPILFESL)"
            description="Line chart comparing headline and core CPI year-over-year inflation since 2000. Both rose sharply in 2021 and 2022, with headline peaking higher and falling faster than core."
            series={[
              { name: "Headline CPI", data: since(headlineYoY, "2000-01-01"), color: "1" },
              { name: "Core CPI (ex food & energy)", data: since(coreYoY, "2000-01-01"), color: "2" },
            ]}
            zeroLine
          />
        </section>

        {/* ---------------- Category breakdown ---------------- */}
        <section aria-labelledby="categories-heading" className="mt-16">
          <h2 id="categories-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
            Where inflation is coming from
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            Year-over-year inflation by major CPI category, sorted fastest-rising
            first, with the same month one year earlier for comparison. Averages
            hide a lot: households that rent, drive, or face medical bills
            experience very different inflation rates from the headline number.
          </p>

          <div className="mt-6 overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">
                Year-over-year CPI inflation by category, latest month versus one year earlier
              </caption>
              <thead>
                <tr className="border-b border-hairline-strong text-left text-xs uppercase tracking-wider text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Category</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    YoY, {formatMonth(categoryRows[0].asOf)}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">YoY, one year earlier</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Change (pp)</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((row) => (
                  <tr key={row.id} className="border-b border-hairline last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <span className="font-medium text-ink">{row.label}</span>
                      <span className="ml-2 font-mono text-xs text-muted">{row.id}</span>
                    </th>
                    <td className="tabular px-4 py-3 text-right font-medium text-ink">
                      {formatPercent(row.now, 1)}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-ink-secondary">
                      {row.yearAgo === null ? "—" : formatPercent(row.yearAgo, 1)}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-ink-secondary">
                      {row.delta === null ? "—" : `${formatSigned(row.delta, 1)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            Why shelter lags: CPI shelter is estimated from ALL tenants' rents
            (and owners' equivalent rent), not just newly signed leases. Because
            leases reprice roughly once a year, a move in asking rents takes
            12–18 months to filter through the whole stock of leases and into
            the index.
          */}
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            A note on shelter: the CPI shelter and rent indexes measure what all
            tenants are paying, not what new leases are signed at. Since most
            leases reprice only once a year, a jump or drop in market asking
            rents takes roughly a year to eighteen months to work through the
            full stock of leases and show up here. Shelter is therefore the
            slowest-moving large component of CPI — it kept headline inflation
            elevated well after market rents had cooled, and it understates rent
            pressure early in a rental boom.
          </p>
        </section>

        {/* ---------------- Wages vs prices ---------------- */}
        <section aria-labelledby="realwage-heading" className="mt-16">
          <h2 id="realwage-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
            Are paychecks keeping up?
          </h2>
          <div className="mt-6">
            <TimeSeriesChart
              title="Wage growth vs. headline inflation"
              subtitle="Year-over-year percent change, monthly, since 2016"
              unit="% YoY"
              sourceLine="U.S. Bureau of Labor Statistics via FRED (CES0500000003, CPIAUCSL)"
              description="Line chart of year-over-year wage growth against headline CPI inflation since 2016. Inflation ran above wage growth for an extended stretch beginning in 2021 before wage growth regained the lead."
              series={[
                { name: "Avg. hourly earnings", data: wageYoYSince2016, color: "1" },
                { name: "Headline CPI", data: headlineYoYSince2016, color: "2", dashed: true },
              ]}
              zeroLine
            />
          </div>

          {/*
            The narrative below is computed, not asserted: `negativeSpells`
            finds every stretch of three or more months where the derived
            real-wage series was negative, and we report the longest one plus
            the latest reading. If future data revisions move the crossing
            dates, this paragraph moves with them.
          */}
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            When the dashed inflation line sits above the wage line, the average
            paycheck is losing ground in real terms.{" "}
            {mainSpell ? (
              <>
                The longest such stretch in this window ran from{" "}
                {formatMonth(mainSpell.start)} through {formatMonth(mainSpell.end)} —{" "}
                {mainSpell.length} consecutive months in which prices grew faster
                than pay, an erosion of purchasing power that compounding made
                worse than any single month suggests.{" "}
              </>
            ) : (
              <>No sustained stretch of falling real wages appears in this window. </>
            )}
            {spells.length > 1 && (
              <>
                {spells.length - 1 === 1
                  ? "One shorter episode"
                  : `${spells.length - 1} shorter episodes`}{" "}
                of negative real wage growth also appear in the data.{" "}
              </>
            )}
            As of {formatMonth(realWageLatest[0])}, real wage growth stands at{" "}
            {formatPercent(realWageLatest[1], 1, true)} —{" "}
            {realWageLatest[1] >= 0
              ? "pay is currently outpacing prices, though the gap is measured against a base that inflation has already reset higher."
              : "prices are once again rising faster than pay."}
          </p>
        </section>

        {/* ---------------- Purchasing-power calculator ---------------- */}
        <section aria-labelledby="calculator-heading" className="mt-16">
          <h2 id="calculator-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
            What has inflation done to your budget?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            Pick a starting year and a monthly budget. The calculator uses the
            actual CPI-U index path — annual averages for the start year, the
            latest monthly index for today — to show what that budget still
            buys and what income it would take to match it now.
          </p>
          <div className="mt-6">
            <PurchasingPowerCalculator
              years={calculatorYears}
              latestCpi={{ date: cpiLatestObs[0], value: cpiLatestObs[1] }}
              sourceId={cpiAll.sourceId}
              retrievedAt={cpiAll.retrievedAt}
            />
          </div>
        </section>

        {/* ---------------- Method & limitations ---------------- */}
        <section aria-labelledby="method-heading" className="mt-16 border-t border-hairline pt-10">
          <h2 id="method-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
            Method &amp; limitations
          </h2>
          <div className="mt-4 max-w-3xl space-y-4 text-sm leading-relaxed text-ink-secondary">
            <p>
              All inflation figures on this page are year-over-year percent
              changes in seasonally adjusted CPI-U indexes from the Bureau of
              Labor Statistics, computed as (index today ÷ index twelve months
              earlier − 1) × 100. Real wage growth deflates average hourly
              earnings by headline CPI using the exact ratio form rather than
              simple subtraction, which matters when rates are large. Percentile
              context lines rank the latest reading against each series’ full
              published history using a midrank convention.
            </p>
            <p>
              What CPI-U captures: the average price change of a fixed-weight
              basket of goods and services purchased by urban consumers,
              covering roughly 90 percent of the U.S. population, with
              substitution handled by geometric means within item categories.
              What it does not capture: rural households; any individual
              household’s actual basket — renters, drivers, and people with
              heavy medical spending face materially different inflation rates
              than the average; the cost of buying a house, which enters only
              indirectly through owners’ equivalent rent; and quality change,
              which BLS adjusts for imperfectly. Shelter measures lag market
              rents by a year or more by construction.
            </p>
            <p>
              Average hourly earnings is a workforce-composition-sensitive
              measure: when low-wage workers lose jobs disproportionately (as in
              2020), the average rises mechanically without anyone getting a
              raise. It covers private-sector employees only and excludes
              benefits. The purchasing-power calculator assumes the national
              CPI-U basket throughout; a household’s true experience depends on
              what it actually buys and where it lives.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
