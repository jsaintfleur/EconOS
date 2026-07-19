import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { getSeries } from "@/lib/data";
import {
  housingAffordabilityIndex,
  latest,
  percentileRank,
  previous,
  since,
  yoyPercentChange,
} from "@/lib/econ";
import {
  formatDollars,
  formatFullDate,
  formatMonth,
  formatNumber,
  formatQuarter,
  formatSigned,
} from "@/lib/format";
import type { Observation } from "@/lib/types";
import { MortgageCalculator } from "./MortgageCalculator";

export const metadata: Metadata = {
  title: "Housing",
  description:
    "Mortgage rates, home prices, construction, and the EconOS Housing Affordability Index — what it actually costs a median-income family to buy the median home.",
};

/* ------------------------------------------------------------------ */
/* Page-local presentation glue. All affordability and mortgage math   */
/* goes through lib/econ; these helpers only group and summarize.      */
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

/** Unweighted mean of a plain number array. */
function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Quarter bucket key ("2024-Q3") for an ISO date. */
function quarterKey(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  return `${isoDate.slice(0, 4)}-Q${Math.floor((month - 1) / 3) + 1}`;
}

export default function HousingPage() {
  /* -------------------------------------------------------------- */
  /* Data. Prices are quarterly (Census/HUD median sales price),     */
  /* rates weekly (Freddie Mac PMMS), incomes annual (Census median  */
  /* family income, latest vintage 2024), construction monthly.      */
  /* -------------------------------------------------------------- */
  const mortgage = getSeries("mortgage_30y");
  const medianPrice = getSeries("median_home_price");
  const caseShiller = getSeries("case_shiller_national");
  const starts = getSeries("housing_starts");
  const permits = getSeries("building_permits");
  const newSales = getSeries("new_home_sales");
  const income = getSeries("median_family_income");

  /* Scorecard values. */
  const mortgageLatest = latest(mortgage.observations)!;
  const mortgagePrev = previous(mortgage.observations)!;
  const mortgagePct = percentileRank(
    mortgage.observations.map(([, v]) => v),
    mortgageLatest[1],
  );

  const priceLatest = latest(medianPrice.observations)!;
  const pricePrev = previous(medianPrice.observations)!;
  /* Quarterly series → YoY uses a lag of 4 periods, not 12. */
  const priceYoY = yoyPercentChange(medianPrice.observations, 4);
  const priceYoYLatest = latest(priceYoY)!;

  const csYoY = yoyPercentChange(caseShiller.observations, 12);
  const csLatest = latest(csYoY)!;
  const csPrev = previous(csYoY)!;

  const startsLatest = latest(starts.observations)!;
  const startsPrev = previous(starts.observations)!;
  const startsPct = percentileRank(
    starts.observations.map(([, v]) => v),
    startsLatest[1],
  );

  /* Income: annual series whose latest value is the 2024 vintage. */
  const incomeLatest = latest(income.observations)!;
  const incomeVintageYear = incomeLatest[0].slice(0, 4);

  /* -------------------------------------------------------------- */
  /* Housing Affordability Index — headline value.                   */
  /* 100 = a median-income family exactly meets the 28% front-end    */
  /* ratio on the median home with 20% down on a 30-year fixed loan. */
  /* Uses: latest quarterly median price, latest weekly mortgage     */
  /* rate, and the 2024 income vintage (incomes publish with a lag). */
  /* -------------------------------------------------------------- */
  const haiLatest = housingAffordabilityIndex(
    priceLatest[1],
    incomeLatest[1],
    mortgageLatest[1],
  );

  /* -------------------------------------------------------------- */
  /* Historical HAI, quarterly since 2000. Alignment rules:          */
  /*  - Price: each quarterly median-price observation is the        */
  /*    anchor; one index value per quarter.                         */
  /*  - Rate: the mean of that quarter's weekly PMMS observations,   */
  /*    bucketed by quarter key — a quarterly average smooths the    */
  /*    week-to-week noise a quarterly index should not inherit.     */
  /*  - Income: annual values are carried across all four quarters   */
  /*    of their calendar year (incomes are only measured yearly).   */
  /*    For quarters after the last published vintage (2024), the    */
  /*    latest vintage is carried forward so the chart reaches the   */
  /*    present on the same basis as the headline number above —     */
  /*    this overstates affordability slightly in those quarters if  */
  /*    incomes have since grown, and is flagged in the prose.       */
  /* -------------------------------------------------------------- */
  const weeklyRatesByQuarter = new Map<string, number[]>();
  for (const [date, rate] of mortgage.observations) {
    const key = quarterKey(date);
    const bucket = weeklyRatesByQuarter.get(key);
    if (bucket) bucket.push(rate);
    else weeklyRatesByQuarter.set(key, [rate]);
  }
  const incomeByYear = new Map(
    income.observations.map(([date, value]) => [date.slice(0, 4), value]),
  );

  const haiHistory: Observation[] = [];
  for (const [date, price] of since(medianPrice.observations, "2000-01-01")) {
    const year = date.slice(0, 4);
    const quarterRates = weeklyRatesByQuarter.get(quarterKey(date));
    /* Carry the annual income across its quarters; carry the last vintage
       forward past its final year (see alignment note above). */
    const annualIncome =
      incomeByYear.get(year) ?? (year > incomeVintageYear ? incomeLatest[1] : undefined);
    if (!quarterRates || annualIncome === undefined) continue;
    haiHistory.push([
      date,
      housingAffordabilityIndex(price, annualIncome, mean(quarterRates)),
    ]);
  }

  /* Reference points for the interpretation, computed from the series:
     the 2012 high (post-crash price trough), the 2021 high (record-low
     rates), and the overall low of the window (the 2022–23 squeeze). */
  const hai2012 = haiHistory
    .filter(([date]) => date.startsWith("2012"))
    .reduce((max, obs) => (obs[1] > max[1] ? obs : max));
  const hai2021 = haiHistory
    .filter(([date]) => date.startsWith("2021"))
    .reduce((max, obs) => (obs[1] > max[1] ? obs : max));
  const haiMin = haiHistory.reduce((min, obs) => (obs[1] < min[1] ? obs : min));

  /* -------------------------------------------------------------- */
  /* Mortgage-calculator defaults, passed as plain serializable      */
  /* props: latest median price rounded to the nearest $1,000, and   */
  /* the latest weekly 30-year rate.                                 */
  /* -------------------------------------------------------------- */
  const defaultPrice = Math.round(priceLatest[1] / 1000) * 1000;

  return (
    <>
      <PageHeader
        question="What does it cost to put a roof over your head?"
        title="Housing"
        lede="Mortgage rates, home prices, and construction — combined into a single affordability measure that asks whether a median-income family can actually buy the median home."
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* ---------------- Scorecard ---------------- */}
        <section aria-label="Housing scorecard" className="mt-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="30-year mortgage rate"
              value={formatNumber(mortgageLatest[1], 2)}
              unit="%"
              observationDate={`Week of ${formatFullDate(mortgageLatest[0])}`}
              change={{
                text: `${formatSigned(mortgageLatest[1] - mortgagePrev[1], 2)} pp`,
                direction: direction(mortgageLatest[1] - mortgagePrev[1]),
              }}
              tone="neutral"
              previousText={`${formatNumber(mortgagePrev[1], 2)}% prior week`}
              contextText={`${ordinal(mortgagePct)} percentile of all weekly readings since ${mortgage.observations[0][0].slice(0, 4)}`}
              definition="Average rate on a 30-year fixed conventional mortgage from Freddie Mac's weekly Primary Mortgage Market Survey."
              interpretation="The price of borrowing for the standard American home loan. A one-point move changes the monthly payment on a typical loan by roughly 9–12% — the calculator below makes this concrete."
              snapshot={mortgage}
            />
            <MetricCard
              label="Median home price"
              value={formatDollars(priceLatest[1])}
              unit="quarterly"
              observationDate={formatQuarter(priceLatest[0])}
              change={{
                text: `${formatSigned(priceYoYLatest[1], 1)}% YoY`,
                direction: direction(priceYoYLatest[1]),
              }}
              tone="neutral"
              previousText={`${formatDollars(pricePrev[1])} in ${formatQuarter(pricePrev[0])}`}
              contextText="Not quality-adjusted: shifts in which homes sell move this number"
              definition="Median sales price of houses sold in the United States (Census/HUD), quarterly, not seasonally adjusted for mix."
              interpretation="Half of homes sold cost more, half less. Because it tracks whatever happens to sell, a quarter heavy in luxury or starter homes moves the median without any underlying price change — check it against Case-Shiller."
              snapshot={medianPrice}
            />
            <MetricCard
              label="Case-Shiller price growth"
              value={formatNumber(csLatest[1], 1)}
              unit="% YoY"
              observationDate={formatMonth(csLatest[0])}
              change={{
                text: `${formatSigned(csLatest[1] - csPrev[1], 1)} pp`,
                direction: direction(csLatest[1] - csPrev[1]),
              }}
              tone="neutral"
              previousText={`${formatNumber(csPrev[1], 1)}% in ${formatMonth(csPrev[0])}`}
              contextText="Repeat-sales method: same-home price changes, immune to sales-mix shifts"
              definition="Year-over-year change in the S&P CoreLogic Case-Shiller U.S. National Home Price Index, which tracks repeat sales of the same homes."
              interpretation="The cleaner read on price appreciation. When it diverges from the median price, the median is being moved by which homes are selling, not by what homes are worth."
              snapshot={caseShiller}
            />
            <MetricCard
              label="Housing starts"
              value={formatNumber(startsLatest[1], 0)}
              unit="thousand, SAAR"
              observationDate={formatMonth(startsLatest[0])}
              change={{
                text: `${formatSigned(startsLatest[1] - startsPrev[1], 0)}k`,
                direction: direction(startsLatest[1] - startsPrev[1]),
              }}
              tone="neutral"
              previousText={`${formatNumber(startsPrev[1], 0)}k in ${formatMonth(startsPrev[0])}`}
              contextText={`${ordinal(startsPct)} percentile of all readings since ${starts.observations[0][0].slice(0, 4)}`}
              definition="New privately-owned housing units on which construction began, at a seasonally adjusted annual rate."
              interpretation="The supply pipeline. Chronic underbuilding relative to household formation is the structural force behind the affordability squeeze — rates and prices are the cyclical ones."
              snapshot={starts}
            />
          </div>
        </section>

        {/* ---------------- Housing Affordability Index ---------------- */}
        <section aria-labelledby="hai-heading" className="mt-16">
          <h2 id="hai-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
            Housing Affordability Index
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Headline index value with its assumptions in full view. */}
            <div className="rounded-lg border border-hairline bg-surface p-5 sm:p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                EconOS Housing Affordability Index
              </p>
              <p className="tabular mt-2 font-display text-5xl font-semibold tracking-tight text-ink">
                {formatNumber(haiLatest, 0)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                100 = a median-income family exactly affords the median home.{" "}
                {haiLatest >= 100 ? "Above" : "Below"} 100 means the median
                family has {haiLatest >= 100 ? "more" : "less"} income than that
                benchmark requires.
              </p>
              <div className="mt-4 border-t border-hairline pt-3 text-xs leading-relaxed text-muted">
                <p className="font-medium text-ink-secondary">Inputs &amp; assumptions</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  <li>
                    Median home price {formatDollars(priceLatest[1])} ({formatQuarter(priceLatest[0])})
                  </li>
                  <li>
                    Median family income {formatDollars(incomeLatest[1])} —{" "}
                    <span className="font-medium">{incomeVintageYear} vintage</span>, the latest
                    published; incomes report with a long lag
                  </li>
                  <li>
                    Mortgage rate {formatNumber(mortgageLatest[1], 2)}% (latest weekly)
                  </li>
                  <li>20% down payment, 30-year fixed-rate loan</li>
                  <li>28% front-end ratio (payment ≤ 28% of gross income)</li>
                  <li>Principal &amp; interest only — no taxes, insurance, or PMI</li>
                </ul>
              </div>
            </div>

            {/* Historical index. */}
            <div className="lg:col-span-2">
              <TimeSeriesChart
                title="Housing Affordability Index, 2000–present"
                subtitle="Quarterly; quarter-average mortgage rate, annual income carried across its year"
                unit="index (100 = exactly affordable)"
                sourceLine="EconOS calculation from Census/HUD, Freddie Mac, and Census income data via FRED"
                description="Line chart of the EconOS Housing Affordability Index since 2000. Affordability collapsed during the mid-2000s bubble, peaked after the crash in the early 2010s and again around 2020 to 2021, then fell to its two-decade low in 2022 before a partial recovery."
                series={[{ name: "Affordability index", data: haiHistory, color: "1" }]}
                valueDecimals={0}
                height={340}
              />
            </div>
          </div>

          {/*
            The reference points below are computed from the series (best
            quarter of 2012, best quarter of 2021, worst quarter overall), so
            the prose follows data revisions instead of hardcoding values.
          */}
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-secondary">
            An index of 100 means the median family, putting 20% down at the
            going rate, would spend exactly 28% of gross income on principal and
            interest for the median home — the conventional lending threshold.
            The two modern affordability peaks bracket today’s reading: in{" "}
            {formatQuarter(hai2012[0])}, with prices still depressed after the
            crash, the index reached {formatNumber(hai2012[1], 0)}; in{" "}
            {formatQuarter(hai2021[0])}, record-low mortgage rates pushed it to{" "}
            {formatNumber(hai2021[1], 0)} even as prices surged. The squeeze
            came when rates jumped while prices held: the index bottomed at{" "}
            {formatNumber(haiMin[1], 0)} in {formatQuarter(haiMin[0])} — the
            least affordable quarter in this window. Today’s{" "}
            {formatNumber(haiLatest, 0)} sits between those extremes:{" "}
            {haiLatest >= 100
              ? "back above the affordability line, but far below the post-crash and pandemic-era peaks"
              : "still below the affordability line that both earlier peaks cleared comfortably"}
            . Recent quarters reuse the {incomeVintageYear} income vintage, so
            they will be revised once newer income data publishes.
          </p>
        </section>

        {/* ---------------- Market charts ---------------- */}
        <section aria-label="Housing market charts" className="mt-16">
          <div className="grid grid-cols-1 gap-6">
            <TimeSeriesChart
              title="30-year fixed mortgage rate"
              subtitle="Weekly, since 2000"
              unit="%"
              sourceLine="Freddie Mac Primary Mortgage Market Survey via FRED (MORTGAGE30US)"
              description="Line chart of the 30-year fixed mortgage rate since 2000, declining from about 8% to below 3% in 2021, then rising sharply above 7% in 2023 before easing."
              series={[{ name: "30-year fixed rate", data: since(mortgage.observations, "2000-01-01"), color: "1" }]}
              valueDecimals={2}
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <TimeSeriesChart
                title="Housing starts vs. building permits"
                subtitle="Thousands of units, seasonally adjusted annual rate, since 2000"
                unit="thousand, SAAR"
                sourceLine="U.S. Census Bureau and HUD via FRED (HOUST, PERMIT)"
                description="Line chart of housing starts and building permits since 2000, collapsing together after 2006 and recovering gradually through the 2010s. Permits lead starts by one to two months."
                series={[
                  { name: "Starts", data: since(starts.observations, "2000-01-01"), color: "1" },
                  { name: "Permits", data: since(permits.observations, "2000-01-01"), color: "2", dashed: true },
                ]}
                valueDecimals={0}
              />
              <TimeSeriesChart
                title="New single-family home sales"
                subtitle="Thousands of units, seasonally adjusted annual rate, since 2000"
                unit="thousand, SAAR"
                sourceLine="U.S. Census Bureau and HUD via FRED (HSN1F)"
                description="Line chart of new home sales since 2000, peaking near 1.4 million in 2005, collapsing below 300 thousand by 2011, and partially recovering since."
                series={[{ name: "New home sales", data: since(newSales.observations, "2000-01-01"), color: "1" }]}
                valueDecimals={0}
              />
            </div>
          </div>
        </section>

        {/* ---------------- Mortgage calculator ---------------- */}
        <section aria-labelledby="calculator-heading" className="mt-16">
          <h2 id="calculator-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
            What would the payment be?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            Defaults are today’s numbers: the latest median sales price and this
            week’s average 30-year rate. Adjust any input — the sensitivity row
            shows how much a single percentage point of rate moves the payment.
          </p>
          <div className="mt-6">
            <MortgageCalculator
              defaultPrice={defaultPrice}
              defaultRatePct={mortgageLatest[1]}
              priceAsOf={formatQuarter(priceLatest[0])}
              rateAsOf={formatFullDate(mortgageLatest[0])}
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
              The affordability index is an EconOS calculation, documented in
              our methodology notes: the mortgage payment on the median home
              (20% down, 30-year fixed at the prevailing rate, principal and
              interest only) is compared with 28% of median family income, and
              the ratio is scaled so 100 means exactly affordable. Historical
              values use each quarter’s average weekly mortgage rate and carry
              annual income across that year’s four quarters; quarters after
              the latest income vintage ({incomeVintageYear}) reuse that
              vintage and are revised when new data lands. The headline value
              mixes observation dates by necessity — quarterly prices, weekly
              rates, annual incomes — and each card above shows its own date.
            </p>
            <p>
              What these measures do not capture: property taxes, homeowners
              insurance (a rapidly growing cost in much of the country),
              mortgage insurance for buyers below 20% down, maintenance, and
              closing costs — all excluded from the payment, so the index
              overstates affordability in absolute terms even as its movement
              over time remains informative. The median sales price is not
              quality-adjusted and shifts with the mix of homes sold, which is
              why Case-Shiller’s repeat-sales index is shown alongside it.
              National figures average over enormous regional variation — the
              affordability picture in Cleveland and coastal California are
              different markets entirely.
            </p>
            <p>
              The index also describes only the buy side of housing. Renters —
              roughly a third of households, and disproportionately the
              households for whom affordability binds hardest — are covered by
              the rent measures on the Inflation page. And the 28% front-end
              convention is a lending rule of thumb, not a statement about what
              families can genuinely sustain at different income levels.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
