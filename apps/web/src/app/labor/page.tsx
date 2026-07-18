import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { getSeries } from "@/lib/data";
import {
  alignSeries,
  latest,
  percentileRank,
  periodChange,
  previous,
  since,
  vacancyUnemploymentRatio,
} from "@/lib/econ";
import {
  formatFullDate,
  formatMonth,
  formatNumber,
  formatSigned,
} from "@/lib/format";
import type { Observation } from "@/lib/types";

export const metadata: Metadata = {
  title: "Labor market",
  description:
    "Unemployment, payrolls, participation, job openings, quits, and claims — plus a vacancies-per-unemployed tightness measure — computed from BLS household, payroll, and JOLTS survey data.",
};

/* ------------------------------------------------------------------ */
/* Page-local presentation glue. Substantive series math lives in      */
/* lib/econ; these helpers only summarize already-computed series for  */
/* context lines and prose.                                            */
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

/** Unweighted mean of the values of an observation slice. */
function meanValue(observations: Observation[]): number {
  const sum = observations.reduce((s, [, v]) => s + v, 0);
  return sum / observations.length;
}

export default function LaborPage() {
  /* -------------------------------------------------------------- */
  /* Data. Three distinct BLS surveys feed this page:                */
  /*  - household survey (CPS): unemployment, participation          */
  /*  - establishment survey (CES): payrolls                         */
  /*  - JOLTS: openings, quits, hires (starts December 2000)         */
  /* plus weekly state UI claims from ETA.                           */
  /* -------------------------------------------------------------- */
  const unemployment = getSeries("unemployment_rate");
  const unemployed = getSeries("unemployed_persons");
  const payrolls = getSeries("payrolls");
  const participation = getSeries("participation_rate");
  const openings = getSeries("job_openings");
  const quits = getSeries("quits_rate");
  const hires = getSeries("hires_rate");
  const claims = getSeries("initial_claims");

  /* Scorecard values. */
  const unempLatest = latest(unemployment.observations)!;
  const unempPrev = previous(unemployment.observations)!;
  const unempPct = percentileRank(
    unemployment.observations.map(([, v]) => v),
    unempLatest[1],
  );

  /*
   * Payrolls are a level (thousands of jobs); the number that moves markets
   * is the month-over-month change. periodChange differences consecutive
   * observations, so a skipped release month yields a two-month change for
   * that one point — acceptable here, and flagged in Method & limitations.
   */
  const payrollMoM = periodChange(payrolls.observations);
  const payrollLatest = latest(payrollMoM)!;
  const payrollPrev = previous(payrollMoM)!;
  /* Trailing 12-month average monthly gain, for context. */
  const payrollTrailingAvg = meanValue(payrollMoM.slice(-12));

  const partLatest = latest(participation.observations)!;
  const partPrev = previous(participation.observations)!;
  const partPct = percentileRank(
    participation.observations.map(([, v]) => v),
    partLatest[1],
  );

  const openingsLatest = latest(openings.observations)!;
  const openingsPrev = previous(openings.observations)!;
  const openingsPct = percentileRank(
    openings.observations.map(([, v]) => v),
    openingsLatest[1],
  );

  const quitsLatest = latest(quits.observations)!;
  const quitsPrev = previous(quits.observations)!;
  const quitsPct = percentileRank(
    quits.observations.map(([, v]) => v),
    quitsLatest[1],
  );

  const claimsLatest = latest(claims.observations)!;
  const claimsPrev = previous(claims.observations)!;
  /* 4-week moving average — the standard way to smooth weekly claims noise. */
  const claimsFourWeekAvg = meanValue(claims.observations.slice(-4));

  /* -------------------------------------------------------------- */
  /* Labor-market tightness: vacancies per unemployed person (V/U).  */
  /* Both inputs are levels in thousands of persons, joined on their */
  /* shared monthly dates across the full JOLTS overlap (Dec 2000–). */
  /* -------------------------------------------------------------- */
  const vuSeries: Observation[] = alignSeries(
    openings.observations,
    unemployed.observations,
  ).map(([date, vacancies, unemployedCount]) => [
    date,
    vacancyUnemploymentRatio(vacancies, unemployedCount),
  ]);
  const vuLatest = latest(vuSeries)!;
  /* Pre-pandemic baseline: everything before March 2020, computed not quoted. */
  const vuPrePandemic = vuSeries.filter(([date]) => date < "2020-03-01");
  const vuPrePandemicAvg = meanValue(vuPrePandemic);

  return (
    <>
      <PageHeader
        question="Who is working, who is hiring, and how tight is the market?"
        title="Labor market"
        lede="Unemployment, hiring, participation, and worker churn from the BLS household, establishment, and JOLTS surveys — and a single tightness measure that ties them together: job openings per unemployed person."
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* ---------------- Scorecard ---------------- */}
        <section aria-label="Labor market scorecard" className="mt-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Unemployment rate"
              value={formatNumber(unempLatest[1], 1)}
              unit="%"
              observationDate={formatMonth(unempLatest[0])}
              change={{
                text: `${formatSigned(unempLatest[1] - unempPrev[1], 1)} pp`,
                direction: direction(unempLatest[1] - unempPrev[1]),
              }}
              tone="goodDown"
              previousText={`${formatNumber(unempPrev[1], 1)}% in ${formatMonth(unempPrev[0])}`}
              contextText={`${ordinal(unempPct)} percentile of all readings since ${unemployment.observations[0][0].slice(0, 4)} — lower is rarer`}
              definition="Share of the civilian labor force that is jobless, available to work, and actively searched in the past four weeks (household survey, U-3)."
              interpretation="The standard slack measure. It misses discouraged workers who stopped searching and part-timers who want full-time work, so read it alongside participation."
              snapshot={unemployment}
            />
            <MetricCard
              label="Payroll change"
              value={formatSigned(payrollLatest[1], 0)}
              unit="thousand, MoM"
              observationDate={formatMonth(payrollLatest[0])}
              change={{
                text: `${formatSigned(payrollLatest[1] - payrollPrev[1], 0)}k vs prior month`,
                direction: direction(payrollLatest[1] - payrollPrev[1]),
              }}
              tone="goodUp"
              previousText={`${formatSigned(payrollPrev[1], 0)}k in ${formatMonth(payrollPrev[0])}`}
              contextText={`Trailing 12-month average: ${formatSigned(payrollTrailingAvg, 0)}k per month`}
              definition="Month-over-month change in total nonfarm payroll employment from the establishment survey, seasonally adjusted."
              interpretation="Roughly 70–100k jobs a month are needed to absorb population growth; sustained readings below that imply a gradually loosening market even without layoffs."
              snapshot={payrolls}
            />
            <MetricCard
              label="Participation rate"
              value={formatNumber(partLatest[1], 1)}
              unit="%"
              observationDate={formatMonth(partLatest[0])}
              change={{
                text: `${formatSigned(partLatest[1] - partPrev[1], 1)} pp`,
                direction: direction(partLatest[1] - partPrev[1]),
              }}
              tone="goodUp"
              previousText={`${formatNumber(partPrev[1], 1)}% in ${formatMonth(partPrev[0])}`}
              contextText={`${ordinal(partPct)} percentile of all readings since ${participation.observations[0][0].slice(0, 4)}`}
              definition="Share of the civilian population aged 16+ either working or actively looking for work."
              interpretation="The denominator check on the unemployment rate: unemployment can fall for the wrong reason if people give up searching. Falling participation with falling unemployment is a warning, not a win."
              snapshot={participation}
            />
            <MetricCard
              label="Job openings"
              value={formatNumber(openingsLatest[1], 0)}
              unit="thousand"
              observationDate={formatMonth(openingsLatest[0])}
              change={{
                text: `${formatSigned(openingsLatest[1] - openingsPrev[1], 0)}k`,
                direction: direction(openingsLatest[1] - openingsPrev[1]),
              }}
              tone="neutral"
              previousText={`${formatNumber(openingsPrev[1], 0)}k in ${formatMonth(openingsPrev[0])}`}
              contextText={`${ordinal(openingsPct)} percentile since JOLTS began in ${openings.observations[0][0].slice(0, 4)}`}
              definition="Unfilled positions on the last business day of the month for which employers are actively recruiting (JOLTS)."
              interpretation="Labor demand in levels. High openings are ambiguous on their own — the tightness section below divides them by the number of unemployed people to make them comparable across cycles."
              snapshot={openings}
            />
            <MetricCard
              label="Quits rate"
              value={formatNumber(quitsLatest[1], 1)}
              unit="% of employment"
              observationDate={formatMonth(quitsLatest[0])}
              change={{
                text: `${formatSigned(quitsLatest[1] - quitsPrev[1], 1)} pp`,
                direction: direction(quitsLatest[1] - quitsPrev[1]),
              }}
              tone="neutral"
              previousText={`${formatNumber(quitsPrev[1], 1)}% in ${formatMonth(quitsPrev[0])}`}
              contextText={`${ordinal(quitsPct)} percentile since JOLTS began in ${quits.observations[0][0].slice(0, 4)}`}
              definition="Voluntary separations as a share of total employment (JOLTS). Excludes layoffs, discharges, and retirements."
              interpretation="Workers mostly quit when they have somewhere better to go, so quits track worker confidence and bargaining power — and tend to lead wage growth."
              snapshot={quits}
            />
            <MetricCard
              label="Initial jobless claims"
              value={formatNumber(claimsLatest[1], 0)}
              unit="claims, weekly"
              observationDate={formatFullDate(claimsLatest[0])}
              change={{
                text: `${formatSigned(claimsLatest[1] - claimsPrev[1], 0)} vs prior week`,
                direction: direction(claimsLatest[1] - claimsPrev[1]),
              }}
              tone="neutral"
              previousText={`${formatNumber(claimsPrev[1], 0)} prior week`}
              contextText={`4-week average: ${formatNumber(claimsFourWeekAvg, 0)} — the standard smoothing for this noisy weekly series`}
              definition="First-time filings for state unemployment insurance benefits, seasonally adjusted."
              interpretation="The fastest layoff signal available — weekly, with days of lag. It measures job losses only; a frozen market with little hiring and little firing keeps claims deceptively low."
              snapshot={claims}
            />
          </div>
        </section>

        {/* ---------------- Chart grid ---------------- */}
        <section aria-label="Labor market charts" className="mt-16">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TimeSeriesChart
              title="Unemployment and participation"
              subtitle="Monthly, seasonally adjusted, since 2000"
              unit="%"
              sourceLine="U.S. Bureau of Labor Statistics via FRED (UNRATE, CIVPART)"
              description="Line chart of the unemployment rate and the labor force participation rate since 2000. Unemployment spikes in recessions while participation has drifted down since its early-2000s peak."
              series={[
                { name: "Unemployment rate", data: since(unemployment.observations, "2000-01-01"), color: "1" },
                { name: "Participation rate", data: since(participation.observations, "2000-01-01"), color: "2" },
              ]}
            />
            <TimeSeriesChart
              title="Monthly payroll change"
              subtitle="Month-over-month change, thousands of jobs, since 2021"
              unit="thousand"
              sourceLine="U.S. Bureau of Labor Statistics via FRED (PAYEMS)"
              description="Bar-like line chart of month-over-month nonfarm payroll changes since 2021, showing the post-pandemic hiring boom cooling toward more modest monthly gains."
              series={[
                { name: "Payroll change", data: since(payrollMoM, "2021-01-01"), color: "1" },
              ]}
              valueDecimals={0}
              zeroLine
            />
            <TimeSeriesChart
              title="Job openings vs. unemployed persons"
              subtitle="Monthly levels, thousands, since 2001"
              unit="thousand"
              sourceLine="U.S. Bureau of Labor Statistics via FRED (JTSJOL, UNEMPLOY)"
              description="Line chart of job openings and unemployed persons since 2001. Unemployment towers over openings in recessions; in 2022 openings exceeded unemployed persons by a record margin."
              series={[
                { name: "Job openings", data: since(openings.observations, "2001-01-01"), color: "1" },
                { name: "Unemployed persons", data: since(unemployed.observations, "2001-01-01"), color: "2" },
              ]}
              valueDecimals={0}
            />
            <TimeSeriesChart
              title="Quits and hires rates"
              subtitle="Share of total employment, monthly, since 2001"
              unit="% of employment"
              sourceLine="U.S. Bureau of Labor Statistics via FRED (JTSQUR, JTSHIR)"
              description="Line chart of the quits rate and hires rate since 2001. Both collapse in recessions and surged in 2021 and 2022 before easing back toward pre-pandemic levels."
              series={[
                { name: "Quits rate", data: since(quits.observations, "2001-01-01"), color: "1" },
                { name: "Hires rate", data: since(hires.observations, "2001-01-01"), color: "2" },
              ]}
            />
          </div>
        </section>

        {/* ---------------- Tightness: V/U ratio ---------------- */}
        <section aria-labelledby="tightness-heading" className="mt-16">
          <h2 id="tightness-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
            How tight is the market?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            The cleanest single tightness measure divides labor demand by labor
            supply: job openings per unemployed person (V/U). It is computed
            here for every month of the JOLTS era in which both series report.
          </p>

          <div className="mt-6">
            <TimeSeriesChart
              title="Vacancies per unemployed person"
              subtitle="Job openings ÷ unemployed persons, monthly, full JOLTS history"
              unit="openings per unemployed person"
              sourceLine="EconOS calculation from BLS data via FRED (JTSJOL ÷ UNEMPLOY)"
              description="Line chart of the ratio of job openings to unemployed persons since late 2000. The ratio collapsed below 0.2 in 2009, climbed above 1 in 2018, spiked to about 2 in 2022, and has since eased back toward 1."
              series={[{ name: "V/U ratio", data: vuSeries, color: "1" }]}
              valueDecimals={2}
            />
          </div>

          {/*
            Interpretation of V/U = 1: one advertised job for every job
            seeker. Above 1, employers are competing for workers (wage
            pressure); below 1, workers are competing for jobs (slack). The
            pre-pandemic average is computed over Dec 2000 – Feb 2020 rather
            than quoted, so it tracks data revisions automatically.
          */}
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            As of {formatMonth(vuLatest[0])}, there{" "}
            {vuLatest[1] >= 0.995 && vuLatest[1] < 1.005 ? "is" : "are"}{" "}
            <span className="font-medium text-ink">
              {formatNumber(vuLatest[1], 2)} job openings per unemployed person
            </span>
            . A ratio of exactly 1 means one advertised job for every active job
            seeker. Above 1, employers outnumber applicants and must compete on
            pay and conditions; below 1, job seekers outnumber openings and
            bargaining power tilts back toward employers. For context, the
            pre-pandemic average (December 2000 through February 2020) was{" "}
            {formatNumber(vuPrePandemicAvg, 2)} — today’s market is{" "}
            {vuLatest[1] > vuPrePandemicAvg ? "tighter" : "looser"} than that
            two-decade norm by{" "}
            {formatNumber(Math.abs(vuLatest[1] - vuPrePandemicAvg), 2)} openings
            per unemployed person, and well off the roughly two-openings-per-person
            extreme the data shows at the 2022 peak.
          </p>

          {/* Beveridge-curve teaser — the full study lives on /research. */}
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            The same two series trace the Beveridge curve — vacancies plotted
            against unemployment — whose outward shift in 2021–22 and partial
            round trip since is one of the more contested stories in recent
            macroeconomics: was it lasting damage to how efficiently workers
            match with jobs, or pandemic churn that unwound on its own? Our full
            study, with the scatter, regime-by-regime fits, and what the curve
            implied for a soft landing, lives on the{" "}
            <Link
              href="/research"
              className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
            >
              Research page
            </Link>
            .
          </p>
        </section>

        {/* ---------------- Method & limitations ---------------- */}
        <section aria-labelledby="method-heading" className="mt-16 border-t border-hairline pt-10">
          <h2 id="method-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
            Method &amp; limitations
          </h2>
          <div className="mt-4 max-w-3xl space-y-4 text-sm leading-relaxed text-ink-secondary">
            <p>
              This page mixes three BLS surveys with different frames and error
              bands. The unemployment and participation rates come from the
              household survey (CPS), a sample of about 60,000 households;
              payrolls come from the establishment survey (CES), which counts
              jobs rather than people — one person holding two jobs is counted
              twice — and is revised twice after first release, sometimes
              substantially. Openings, quits, and hires come from JOLTS, a much
              smaller establishment sample with a one-month extra lag and wider
              revisions. Initial claims are an administrative count from state
              UI systems: near-real-time, but covering only workers eligible
              for (and filing for) benefits.
            </p>
            <p>
              The V/U ratio is our calculation — JOLTS openings divided by CPS
              unemployed persons, matched by month — and inherits both surveys’
              limitations: openings measure advertised positions, not the
              intensity with which firms recruit for them, and posting a
              vacancy has become cheaper over time, which can inflate the
              numerator relative to earlier decades. Payroll month-over-month
              changes are computed between consecutive published observations;
              where a monthly release was missed (several 2025 federal releases
              were skipped), a single point spans two months. Percentile
              context lines rank the latest value against each series’ full
              published history and describe rarity, not desirability.
            </p>
            <p>
              None of these measures capture the quality dimension of work —
              hours, benefits, security, or whether a job matches a worker’s
              skills. A low unemployment rate is compatible with widespread
              underemployment, and headline tightness can coexist with slack in
              particular regions, occupations, and demographic groups.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
