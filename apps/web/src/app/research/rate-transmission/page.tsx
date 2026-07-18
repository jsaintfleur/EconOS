import type { Metadata } from "next";
import Link from "next/link";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { Provenance } from "@/components/ui/Provenance";
import { getSeries } from "@/lib/data";
import { since } from "@/lib/econ";
import { formatMonth, formatPercent } from "@/lib/format";
import { transmissionAssociations } from "@/app/simulator/associations";
import { FindingStats, ModuleSection, ReproduceSection } from "../module-sections";
import { ScatterChart, type ScatterFitLine, type ScatterGroup } from "../ScatterChart";
import { changeOverMonths, laggedPairs, monthlyAverage, percentChangeOverMonths } from "../transforms";

/**
 * /research/rate-transmission — How do policy rates reach the housing market?
 *
 * This is the research write-up behind the /simulator estimates. The
 * coefficients are imported from src/app/simulator/associations.ts — not
 * re-typed — and the scatter below rebuilds the estimation sample with the
 * same shared transforms, so what the reader sees is exactly what the
 * simulator uses.
 */

export const metadata: Metadata = {
  title: "Rate transmission · Research",
  description:
    "How do policy rates reach the housing market? Pass-through from the federal funds rate to mortgage rates, the lagged response of housing starts, and why these are associations rather than causal effects.",
};

/** Estimation window start — must match associations.ts. */
const WINDOW_START = "1990-01-01";

export default function RateTransmissionPage() {
  const fedFunds = getSeries("fed_funds");
  const mortgage = getSeries("mortgage_30y");
  const starts = getSeries("housing_starts");
  const { passThrough, housingStarts, newHomeSales, constructionEmployment, durables } =
    transmissionAssociations;

  // Levels chart: the policy rate against the monthly-averaged mortgage rate.
  const mortgageMonthly = monthlyAverage(mortgage.observations);
  const fedFundsSince1990 = since(fedFunds.observations, WINDOW_START);
  const mortgageSince1990 = since(mortgageMonthly, WINDOW_START);

  // Estimation scatter: 12-month % change in housing starts against the
  // 12-month mortgage-rate change six months earlier — the exact sample the
  // housing-starts association is fitted on (same transforms, same lag).
  const mortgageChange12 = changeOverMonths(mortgageMonthly, 12);
  const startsGrowth12 = percentChangeOverMonths(starts.observations, 12);
  const scatterSample = laggedPairs(mortgageChange12, startsGrowth12, housingStarts.lagMonths)
    .filter((pair) => pair.date >= WINDOW_START);

  const groups: ScatterGroup[] = [
    {
      name: `Months ${housingStarts.window}`,
      color: "1",
      points: scatterSample.map((pair) => ({
        x: pair.x,
        y: pair.y,
        label: formatMonth(pair.date),
      })),
    },
  ];

  // Fit line endpoints from the imported OLS coefficients.
  const xs = scatterSample.map((pair) => pair.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const fitLines: ScatterFitLine[] = [
    {
      name: "OLS fit (simulator coefficient)",
      color: "2",
      from: { x: xMin, y: housingStarts.intercept + housingStarts.slope * xMin },
      to: { x: xMax, y: housingStarts.intercept + housingStarts.slope * xMax },
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        question="How do policy rates reach the housing market?"
        title="Rate transmission"
        lede="The Federal Reserve does not set mortgage rates, house prices, or construction payrolls — it sets an overnight rate and the rest is transmission. This module estimates each link in that chain and is the methodological source for the rate simulator."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ModuleSection title="Question">
          <p>
            When the federal funds rate moves, how much of that move reaches the 30-year
            mortgage rate, and how much housing activity has historically moved with it — at
            what delay?
          </p>
        </ModuleSection>

        <ModuleSection title="Theory">
          <p>
            The textbook chain runs: policy rate → long-term Treasury yields (via expected
            future short rates and term premia) → mortgage rates (Treasuries plus an MBS
            spread) → affordability at prevailing prices → sales and starts → construction
            hiring and big-ticket spending. Two features matter for estimation. First,
            expectations: mortgage rates price the expected path of policy, so they often move
            before the policy rate does. Second, delay: households and builders commit to
            projects months before the activity is recorded, so the real-side response should
            appear with a lag — which is why the specifications below lag the rate change by
            six to twelve months.
          </p>
        </ModuleSection>

        <ModuleSection title="Data">
          <p>
            The effective federal funds rate (monthly), the 30-year fixed mortgage rate
            (weekly, averaged to monthly before any differencing so all series share one
            calendar), housing starts, new single-family home sales, construction employment,
            and durable-goods spending. Estimation window: {passThrough.window}, on 12-month
            changes.
          </p>
          <div className="space-y-1">
            <Provenance snapshot={fedFunds} />
            <Provenance snapshot={mortgage} />
            <Provenance snapshot={starts} />
          </div>
        </ModuleSection>

        <ModuleSection title="Method">
          <p>
            Each link is a two-variable OLS on 12-month changes since 1990: the mortgage-rate
            change on the policy-rate change (contemporaneous), then 12-month percent changes
            in each activity series on the mortgage-rate change lagged{" "}
            {housingStarts.lagMonths} months (starts, sales) or{" "}
            {constructionEmployment.lagMonths} months (construction employment), and durables
            spending on the policy-rate change lagged {durables.lagMonths} months. The charts
            below show the first and third links; the full coefficient table, including the
            judgment ranges the simulator displays, is on the{" "}
            <Link
              href="/simulator"
              className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
            >
              simulator page
            </Link>
            .
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <TimeSeriesChart
              title="Policy rate vs. 30-year mortgage rate"
              subtitle="Levels, monthly (mortgage rate averaged from weekly)"
              unit="%"
              sourceLine="Federal Reserve & Freddie Mac PMMS via FRED"
              description="Line chart of the federal funds rate and the 30-year mortgage rate since 1990. The two decline together over three decades, with the mortgage rate consistently higher and smoother; after 2022 both rise sharply, the mortgage rate to around 7 percent."
              series={[
                { name: "Federal funds rate", data: fedFundsSince1990, color: "2" },
                { name: "30-year mortgage rate", data: mortgageSince1990, color: "1" },
              ]}
            />
            <ScatterChart
              title="Housing starts vs. earlier mortgage-rate changes"
              subtitle={`12-month % change in starts against the 12-month mortgage-rate change ${housingStarts.lagMonths} months earlier`}
              xLabel="Mortgage-rate change, 12m (pp)"
              yLabel="Housing starts change, 12m (%)"
              xUnit="pp"
              yUnit="%"
              sourceLine={`Census/HUD & Freddie Mac via FRED · ${housingStarts.window} · EconOS estimation`}
              description={`Scatter plot of 12-month percent changes in housing starts against lagged 12-month mortgage-rate changes since 1990, with a downward-sloping fitted line of slope ${housingStarts.slope.toFixed(1)} percent per percentage point. The cloud is wide: the fit explains about ${Math.round(housingStarts.r2 * 100)} percent of the variation.`}
              groups={groups}
              fitLines={fitLines}
            />
          </div>
        </ModuleSection>

        <ModuleSection title="Findings">
          <div>
            <FindingStats
              items={[
                {
                  label: "Mortgage pass-through",
                  value: `${passThrough.slope.toFixed(2)} pp/pp`,
                  detail: `About ${formatPercent(passThrough.slope * 100, 0)} of a 12-month policy-rate change has appeared in the 30-year mortgage rate over the same window (R² ${passThrough.r2.toFixed(2)}, n = ${passThrough.n}).`,
                },
                {
                  label: "Housing-starts sensitivity",
                  value: `${housingStarts.slope.toFixed(1)}% per pp`,
                  detail: `12-month change in starts per 1pp mortgage-rate rise ${housingStarts.lagMonths} months earlier (R² ${housingStarts.r2.toFixed(2)}); new-home sales similar at ${newHomeSales.slope.toFixed(1)}% (R² ${newHomeSales.r2.toFixed(2)}).`,
                },
                {
                  label: "The chain fades with distance",
                  value: `R² ${constructionEmployment.r2.toFixed(2)} / ${durables.r2.toFixed(2)}`,
                  detail: `Construction employment (slope ${constructionEmployment.slope.toFixed(1)}) and durables spending (slope ${durables.slope.toFixed(1)}) show essentially no simple bivariate association with earlier rate changes.`,
                },
              ]}
            />
          </div>
          <p>
            Transmission is real but heavily attenuated and slow. Less than half of a policy
            move shows up in mortgage rates on this simple measure — partly because mortgage
            rates price expected policy in advance, so the regression splits credit between
            anticipation and the move itself. One step further down, a 1pp mortgage-rate rise
            is associated with roughly {formatPercent(Math.abs(housingStarts.slope), 0)} fewer
            starts a half-year later, but with enormous scatter. By the time the chain
            reaches employment and durable spending, the bivariate link is statistically
            almost invisible — those outcomes answer to many forces of which financing cost
            is only one.
          </p>
        </ModuleSection>

        <ModuleSection title="Uncertainty">
          <p>
            The dominant issue is endogeneity, not sampling noise. The Federal Reserve raises
            rates when housing and spending are already strong and cuts when they weaken, so
            the estimated slopes blend the effect of rates with the conditions that prompted
            them — most likely biasing the measured sensitivity of activity toward zero.
            Pass-through itself varies by regime: it was near-mechanical in the 2022
            tightening, and nearly absent during the years at the zero lower bound. These are
            reasons the simulator wraps every coefficient in a wide judgment range (0.5× to
            1.5× the estimate) rather than a confidence interval.
          </p>
        </ModuleSection>

        <ModuleSection title="Limitations">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-ink">Association, not causation.</span> None
              of these regressions identify a causal effect of policy; doing so requires
              isolating unanticipated policy surprises, which is beyond a two-variable OLS.
            </li>
            <li>
              <span className="font-medium text-ink">Fixed lags are a simplification.</span>{" "}
              True transmission is spread over many months and varies by episode; a single
              6- or 12-month lag is a legible approximation, and the results shift with the
              lag choice.
            </li>
            <li>
              <span className="font-medium text-ink">One window, averaged regimes.</span> A
              single slope over {passThrough.window} averages across the Volcker aftermath,
              the Great Moderation, the zero-lower-bound decade, and the 2022 tightening —
              regimes with visibly different transmission.
            </li>
          </ul>
          <p>
            Try the estimates interactively — with every provenance tag and range visible —
            in the{" "}
            <Link
              href="/simulator"
              className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
            >
              Interest-Rate Transmission Simulator
            </Link>
            .
          </p>
        </ModuleSection>

        <ReproduceSection modulePath="apps/web/src/app/research/rate-transmission/page.tsx (estimation in ../../simulator/associations.ts)" />
      </div>
    </div>
  );
}
