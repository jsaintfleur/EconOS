import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Provenance } from "@/components/ui/Provenance";
import { getSeries } from "@/lib/data";
import { alignSeries, vacancyUnemploymentRatio } from "@/lib/econ";
import { formatMonth, formatPercent } from "@/lib/format";
import type { Observation } from "@/lib/types";
import { FindingStats, ModuleSection, ReproduceSection } from "../module-sections";
import { ScatterChart, type ScatterGroup } from "../ScatterChart";

/**
 * /research/beveridge-curve — How efficiently does the labor market match
 * workers to jobs?
 *
 * The Beveridge curve plots job vacancies against unemployment. Its position
 * is a matching-efficiency gauge: for a given number of unemployed workers,
 * more unfilled openings means the market is having a harder time putting
 * the two together. Movements ALONG the curve track the business cycle;
 * SHIFTS of the whole curve signal changes in how well matching works.
 */

export const metadata: Metadata = {
  title: "Beveridge curve · Research",
  description:
    "How efficiently does the labor market match workers to jobs? Vacancies versus unemployment since 2001, the outward COVID shift, and the descent since 2022.",
};

/** One month on the curve. */
interface CurvePoint {
  date: string;
  vacancyRate: number;
  unemploymentRate: number;
}

/**
 * Vacancy-rate proxy, matching the JOLTS job-openings-rate definition:
 * openings as a share of filled jobs plus openings, ×100. Route-local
 * because it is specific to this module's construction; the level-based
 * V/U tightness ratio lives in lib/econ.
 */
function vacancyRate(openings: number, payrolls: number): number {
  return (openings / (payrolls + openings)) * 100;
}

/** The four period regimes plotted with chart colors 1–4, in order. */
const PERIODS = [
  { name: "2001–2009", color: "1", from: "2001-01", to: "2009-12" },
  { name: "2010–2019", color: "2", from: "2010-01", to: "2019-12" },
  { name: "2020–2021", color: "3", from: "2020-01", to: "2021-12" },
  { name: "2022–present", color: "4", from: "2022-01", to: "9999-12" },
] as const;

/**
 * Mean vacancy rate among months (within a period) whose unemployment rate
 * sits near `targetU` — how the outward shift is quantified: same
 * unemployment, different vacancies. Returns null when too few months match.
 */
function meanVacancyNearUnemployment(
  points: CurvePoint[],
  period: { from: string; to: string },
  targetU: number,
  tolerance = 0.3,
): { mean: number; months: number } | null {
  const matches = points.filter(
    (p) =>
      p.date.slice(0, 7) >= period.from &&
      p.date.slice(0, 7) <= period.to &&
      Math.abs(p.unemploymentRate - targetU) <= tolerance,
  );
  if (matches.length < 3) return null;
  return {
    mean: matches.reduce((sum, p) => sum + p.vacancyRate, 0) / matches.length,
    months: matches.length,
  };
}

export default function BeveridgeCurvePage() {
  const openings = getSeries("job_openings");
  const payrolls = getSeries("payrolls");
  const unemployment = getSeries("unemployment_rate");
  const unemployed = getSeries("unemployed_persons");

  // Vacancy rate per month (openings and payrolls share dates), then paired
  // with the unemployment rate. alignSeries drops the unemployment gap month
  // (2025-10) instead of mis-pairing it.
  const vacancySeries: Observation[] = alignSeries(openings.observations, payrolls.observations)
    .filter(([date]) => date >= "2001-01-01")
    .map(([date, o, p]) => [date, vacancyRate(o, p)]);

  const points: CurvePoint[] = alignSeries(vacancySeries, unemployment.observations).map(
    ([date, v, u]): CurvePoint => ({ date, vacancyRate: v, unemploymentRate: u }),
  );

  const groups: ScatterGroup[] = PERIODS.map((period) => ({
    name: period.name,
    color: period.color,
    points: points
      .filter((p) => p.date.slice(0, 7) >= period.from && p.date.slice(0, 7) <= period.to)
      .map((p) => ({ x: p.unemploymentRate, y: p.vacancyRate, label: formatMonth(p.date) })),
  }));

  // Representative points, derived from the data rather than hand-picked:
  // the slackest month (min vacancy), the tightest (max vacancy), latest.
  const slackest = points.reduce((a, b) => (b.vacancyRate < a.vacancyRate ? b : a));
  const tightest = points.reduce((a, b) => (b.vacancyRate > a.vacancyRate ? b : a));
  const latestPoint = points[points.length - 1];

  // The outward shift: mean vacancy rate at ~6% unemployment, 2010s vs
  // the 2020–21 reopening.
  const TARGET_U = 6.0;
  const shiftBefore = meanVacancyNearUnemployment(points, { from: "2010-01", to: "2019-12" }, TARGET_U);
  const shiftDuring = meanVacancyNearUnemployment(points, { from: "2020-06", to: "2021-12" }, TARGET_U);

  // Labor-market tightness (levels): vacancies per unemployed person.
  const vuPairs = alignSeries(openings.observations, unemployed.observations);
  const lastVU = vuPairs[vuPairs.length - 1];
  const tightnessRatio = lastVU ? vacancyUnemploymentRatio(lastVU[1], lastVU[2]) : NaN;

  return (
    <div className="pb-16">
      <PageHeader
        question="How efficiently does the labor market match workers to jobs?"
        title="The Beveridge curve"
        lede="Unemployment and unfilled jobs coexist because matching takes time. Plotting one against the other reveals whether the labor market's matchmaking is getting better or worse — and the past five years contain the most dramatic Beveridge-curve movements on record."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ModuleSection title="Question">
          <p>
            When workers are looking and jobs are open, how well does the labor market bring
            them together — and did the pandemic permanently damage that matching process?
          </p>
        </ModuleSection>

        <ModuleSection title="Theory">
          <p>
            In search-and-matching models the labor market is a two-sided search problem:
            unemployed workers and vacant jobs meet through a matching function, and both can
            be plentiful at once if matching is slow. The Beveridge curve is the resulting
            locus: vacancies high when unemployment is low (tight markets) and vice versa, a
            downward-sloping curve traced out by demand over the cycle. Its position encodes
            efficiency — an outward shift means more vacancies are needed to employ the same
            share of the workforce, from mismatch in skills, geography, or search intensity.
            Theory also predicts loops: after a shock, vacancies recover before unemployment
            falls, so the economy circles counterclockwise back toward the curve.
          </p>
        </ModuleSection>

        <ModuleSection title="Data">
          <p>
            Job openings from JOLTS (monthly, from December 2000), nonfarm payrolls, and the
            unemployment rate, {formatMonth(points[0].date)} through{" "}
            {formatMonth(latestPoint.date)}. The vacancy rate is constructed as openings ÷
            (payrolls + openings) × 100 — the JOLTS job-openings-rate definition. The
            unemployment series skips October 2025 (missed federal release); that month is
            dropped from the pairing rather than interpolated.
          </p>
          <div className="space-y-1">
            <Provenance snapshot={openings} />
            <Provenance snapshot={payrolls} />
            <Provenance snapshot={unemployment} />
          </div>
        </ModuleSection>

        <ModuleSection title="Method">
          <p>
            Each month since January 2001 is plotted as a point (unemployment rate on the
            horizontal axis, vacancy rate on the vertical), colored by period: the 2001–09
            era spanning two recessions, the long 2010s expansion, the 2020–21 pandemic
            shock and reopening, and 2022–present. No curve is fitted — the relationship is
            visibly nonlinear and the object of interest is the cloud&rsquo;s position, not a
            slope.
          </p>
          <ScatterChart
            title="The Beveridge curve, 2001–present"
            subtitle="Each point is one month, colored by period"
            xLabel="Unemployment rate (%)"
            yLabel="Vacancy rate (%)"
            xUnit="%"
            yUnit="%"
            sourceLine="BLS JOLTS, CES & CPS via FRED · EconOS construction"
            description={`Scatter plot of monthly vacancy rates against unemployment rates since 2001, forming downward-sloping bands by period. The 2020 to 2021 points sit far to the right and then above earlier periods, the 2022 cluster reaches a vacancy rate of ${tightest.vacancyRate.toFixed(1)} percent at ${tightest.unemploymentRate.toFixed(1)} percent unemployment, and the latest points descend back toward the pre-pandemic range.`}
            groups={groups}
          />
        </ModuleSection>

        <ModuleSection title="Findings">
          <div>
            <FindingStats
              items={[
                {
                  label: "The outward COVID shift",
                  value:
                    shiftBefore && shiftDuring
                      ? `${formatPercent(shiftBefore.mean, 1)} → ${formatPercent(shiftDuring.mean, 1)}`
                      : "—",
                  detail:
                    shiftBefore && shiftDuring
                      ? `Mean vacancy rate in months with unemployment near ${formatPercent(TARGET_U, 0)}: 2010s (${shiftBefore.months} months) vs. 2020–21 (${shiftDuring.months} months). Same unemployment, far more unfilled jobs.`
                      : "Insufficient overlapping months to compute.",
                },
                {
                  label: "The 2022 extreme",
                  value: formatPercent(tightest.vacancyRate, 1),
                  detail: `Peak vacancy rate (${formatMonth(tightest.date)}) at just ${formatPercent(tightest.unemploymentRate, 1)} unemployment — against ${formatPercent(slackest.vacancyRate, 1)} at ${formatPercent(slackest.unemploymentRate, 1)} in ${formatMonth(slackest.date)}, the slackest month in the sample.`,
                },
                {
                  label: "Latest position",
                  value: `${formatPercent(latestPoint.vacancyRate, 1)} at ${formatPercent(latestPoint.unemploymentRate, 1)}`,
                  detail: `Vacancy rate at unemployment rate, ${formatMonth(latestPoint.date)} — about ${Number.isFinite(tightnessRatio) ? tightnessRatio.toFixed(2) : "—"} vacancies per unemployed worker (V/U).`,
                },
              ]}
            />
          </div>
          <p>
            The pandemic produced both of the curve&rsquo;s canonical motions in rapid succession.
            First a violent move along it (unemployment to{" "}
            {formatPercent(Math.max(...points.map((p) => p.unemploymentRate)), 1)} in April
            2020 while vacancies fell only modestly), then an outward shift: through the
            reopening, the same unemployment rate coexisted with roughly{" "}
            {shiftBefore && shiftDuring
              ? formatPercent(shiftDuring.mean - shiftBefore.mean, 1)
              : "several points"}{" "}
            more vacancy than the 2010s norm — matching had genuinely deteriorated while
            workers and jobs re-sorted. Since 2022 the economy has descended the vertical
            segment of the curve: vacancies fell from {formatPercent(tightest.vacancyRate, 1)}{" "}
            toward {formatPercent(latestPoint.vacancyRate, 1)} while unemployment rose only
            about{" "}
            {formatPercent(latestPoint.unemploymentRate - tightest.unemploymentRate, 1)} — the
            historically unusual “soft-landing” path, cooling mostly through fewer openings
            rather than more layoffs.
          </p>
        </ModuleSection>

        <ModuleSection title="Uncertainty">
          <p>
            The outward-shift comparison depends on which months are matched: it uses months
            with unemployment within ±0.3pp of {formatPercent(TARGET_U, 0)}, and widening or
            narrowing that band moves the contrast by a few tenths. Whether the curve has
            fully returned to its pre-pandemic position is genuinely unresolved — the latest
            points sit near the top of the 2010s cloud, close enough that normal JOLTS
            revisions could move the verdict either way.
          </p>
        </ModuleSection>

        <ModuleSection title="Limitations">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-ink">Openings ≠ search intensity.</span> A
              posted vacancy is free to leave up; recruiting effort per opening varies with
              the cycle, and low-cost online posting has made an opening in 2026 a different
              object from one in 2001. Part of any apparent shift is measurement, not
              matching.
            </li>
            <li>
              <span className="font-medium text-ink">JOLTS revisions and coverage.</span> The
              survey is revised substantially, has a modest sample for monthly readings, and
              its response rate has fallen sharply since 2020 — recent months are the least
              settled part of the picture.
            </li>
            <li>
              <span className="font-medium text-ink">Position, not mechanism.</span> The curve
              cannot by itself say why it shifted — skills mismatch, geographic mismatch,
              enhanced benefits, and reallocation all produce similar outward movements.
            </li>
          </ul>
        </ModuleSection>

        <ReproduceSection modulePath="apps/web/src/app/research/beveridge-curve/page.tsx" />
      </div>
    </div>
  );
}
