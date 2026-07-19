import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSeries } from "@/lib/data";
import { alignSeries, realGrowthRate } from "@/lib/econ";
import { formatPercent } from "@/lib/format";
import type { Observation } from "@/lib/types";
import { transmissionAssociations } from "@/app/simulator/associations";
import { okunResults } from "./okuns-law/okun";
import { percentChangeOverMonths } from "./transforms";

/**
 * /research — index of the research modules.
 *
 * Each module takes a piece of textbook economics, states what the theory
 * predicts, and checks it against the committed data snapshots. The key
 * finding on every card is computed at build time from the same code path
 * as the module page itself (imported, not retyped), so the index can never
 * drift out of sync with the analysis.
 */

export const metadata: Metadata = {
  title: "Research",
  description:
    "Four data-driven checks of textbook economics: real wages, Okun's law, the Beveridge curve, and interest-rate transmission — each with method, findings, and limitations.",
};

/** Latest real (inflation-adjusted) wage growth, year over year. */
function latestRealWageGrowth(): { value: number; date: string } | null {
  const wageGrowth = percentChangeOverMonths(getSeries("avg_hourly_earnings").observations, 12);
  const inflation = percentChangeOverMonths(getSeries("cpi_all").observations, 12);
  const aligned = alignSeries(wageGrowth, inflation);
  const last = aligned[aligned.length - 1];
  if (!last) return null;
  const [date, nominal, cpi] = last;
  return { value: realGrowthRate(nominal, cpi), date };
}

/**
 * Latest vacancy rate (openings share of jobs plus openings) and the
 * unemployment rate from the SAME month, so the curve position is one
 * coherent point rather than a mix of release dates.
 */
function latestLaborMarketPoint(): { vacancyRate: number; unemployment: number } | null {
  const vacancy: Observation[] = alignSeries(
    getSeries("job_openings").observations,
    getSeries("payrolls").observations,
  ).map(([date, openings, payrolls]) => [date, (openings / (payrolls + openings)) * 100]);
  const paired = alignSeries(vacancy, getSeries("unemployment_rate").observations);
  const last = paired[paired.length - 1];
  if (!last) return null;
  const [, vacancyRate, unemployment] = last;
  return { vacancyRate, unemployment };
}

export default function ResearchIndexPage() {
  const realWage = latestRealWageGrowth();
  const laborPoint = latestLaborMarketPoint();
  const okun = okunResults.full;
  const passThrough = transmissionAssociations.passThrough;

  /** The four module cards, each with a computed key finding. */
  const modules = [
    {
      href: "/research/real-wages",
      title: "Real wages",
      question: "Have wages kept up with prices?",
      method:
        "Year-over-year average hourly earnings deflated by CPI-U, plus a cumulative real wage index since 2006.",
      finding: realWage
        ? `Real wage growth is ${formatPercent(realWage.value, 1, true)} year over year — nominal gains and inflation are nearly offsetting.`
        : "Real wage growth is computed at build time.",
    },
    {
      href: "/research/okuns-law",
      title: "Okun's law",
      question: "Do recessions destroy jobs one-for-one with output?",
      method:
        "Quarterly change in the unemployment rate regressed on real GDP growth (SAAR), 1960 to present.",
      finding: `Okun coefficient ${okun.slope.toFixed(2)} (R² ${okun.r2.toFixed(2)}): growth near ${formatPercent(okunResults.stableGrowthRate, 1)} SAAR has historically held unemployment steady.`,
    },
    {
      href: "/research/beveridge-curve",
      title: "The Beveridge curve",
      question: "How efficiently does the labor market match workers to jobs?",
      method:
        "Vacancy rate (openings ÷ (payrolls + openings)) against the unemployment rate, monthly since 2001, colored by period.",
      finding: laborPoint
        ? `Latest point: vacancy rate ${formatPercent(laborPoint.vacancyRate, 1)} at ${formatPercent(laborPoint.unemployment, 1)} unemployment — down the curve from the 2022 extreme.`
        : "The latest curve position is computed at build time.",
    },
    {
      href: "/research/rate-transmission",
      title: "Rate transmission",
      question: "How do policy rates reach the housing market?",
      method:
        "OLS of 12-month mortgage-rate changes on policy-rate changes, then lagged housing-activity responses, since 1990.",
      finding: `About ${formatPercent(passThrough.slope * 100, 0)} of a 12-month policy-rate change has historically appeared in the 30-year mortgage rate (R² ${passThrough.r2.toFixed(2)}).`,
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        question="What does economic theory say — and does the data agree?"
        title="Research"
        lede="Short, reproducible modules that test textbook relationships against the platform's own data snapshots. Every number is computed at build time; every module says what it cannot claim."
      />

      <div className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group flex flex-col rounded-lg border border-hairline bg-surface p-6 transition-colors hover:border-hairline-strong hover:bg-surface-raised"
            >
              <p className="text-xs font-medium uppercase tracking-widest text-accent">
                {module.question}
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-ink group-hover:text-accent-strong">
                {module.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{module.method}</p>
              <p className="mt-4 border-t border-hairline pt-3 text-sm leading-relaxed text-ink">
                {module.finding}
              </p>
            </Link>
          ))}
        </div>

        {/* The shared module template, stated once so readers know the shape. */}
        <section className="mt-10 rounded-lg border border-hairline bg-surface p-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            How every module is structured
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
            Each module follows the same template, with these as its section headings, in this
            order:
          </p>
          <p className="mt-3 text-sm font-medium text-ink">
            Question → Theory → Data → Method → Findings → Uncertainty → Limitations → Reproduce
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
            The question is stated up front; theory says what a textbook predicts; data and
            method say exactly which series and calculations are used; findings report computed
            numbers with their dates; uncertainty and limitations say what the analysis cannot
            support; and reproduce points at the code so the result can be checked.
          </p>
        </section>
      </div>
    </div>
  );
}
