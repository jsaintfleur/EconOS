import type { Metadata } from "next";
import Link from "next/link";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import {
  ConditionsStrip,
  type ConditionFigure,
} from "@/components/home/ConditionsStrip";
import { LayerCard, type LayerCardProps } from "@/components/home/LayerCard";
import { getSeries } from "@/lib/data";
import { latest, periodChange, since, yoyPercentChange } from "@/lib/econ";
import {
  formatMonth,
  formatObservationDate,
  formatPercent,
  formatSigned,
} from "@/lib/format";

/**
 * Landing page.
 *
 * The pitch is the product thesis — EconOS traces macroeconomic forces down
 * to household outcomes — and the proof is real data: instead of a hero
 * image, the page opens with four current, dated readings computed at build
 * time from the same snapshots that power every other page.
 */

export const metadata: Metadata = {
  title: {
    // The landing page carries the full product name itself, so skip the
    // "%s · EconOS" template from the root layout.
    absolute: "EconOS — From Macroeconomic Forces to Household Outcomes",
  },
  description:
    "EconOS is an economic intelligence platform that connects inflation, interest rates, employment, and housing to the outcomes households actually experience — with sourced data, visible uncertainty, and reproducible methods.",
};

/**
 * The five product layers and the question each one answers. Ordered along
 * the product's narrative arc: observe → understand impact → research →
 * anticipate → simulate.
 */
const LAYERS: LayerCardProps[] = [
  {
    name: "Observatory",
    question: "What is happening in the economy right now?",
    description:
      "A sourced scorecard of growth, prices, labor, and rates — every reading dated and ranked against its own history.",
    href: "/overview",
    linkLabel: "Open the overview",
  },
  {
    name: "Impact",
    question: "What do these forces mean for a household budget?",
    description:
      "Calculators that translate inflation and mortgage rates into purchasing power, monthly payments, and affordability.",
    href: "/inflation",
    linkLabel: "Measure the impact",
  },
  {
    name: "Research Lab",
    question: "How do economic forces actually relate to each other?",
    description:
      "Documented historical associations — wages and prices, vacancies and unemployment — with methods shown and causal claims withheld.",
    href: "/research",
    linkLabel: "Read the research",
  },
  {
    name: "Forecast Center",
    question: "Where might key indicators go next?",
    description:
      "Backtested statistical forecasts published with uncertainty bands and a track record — never a point estimate alone.",
    href: "/forecasts",
    linkLabel: "See the forecasts",
  },
  {
    name: "Transmission Engine",
    question: "If the Fed moves, what happens downstream?",
    description:
      "An interactive model of how policy-rate changes propagate through mortgages, credit, spending, and employment over time.",
    href: "/simulator",
    linkLabel: "Run a scenario",
  },
];

export default function HomePage() {
  // --- Current-conditions figures, computed from real snapshots. -----------
  const cpiAll = getSeries("cpi_all");
  const unemployment = getSeries("unemployment_rate");
  const mortgage = getSeries("mortgage_30y");
  const payrolls = getSeries("payrolls");
  const earnings = getSeries("avg_hourly_earnings");

  // Headline CPI inflation: 12-month percent change in the all-items index.
  const cpiYoY = yoyPercentChange(cpiAll.observations);
  const inflationNow = latest(cpiYoY);
  const unemploymentNow = latest(unemployment.observations);
  const mortgageNow = latest(mortgage.observations);
  // Payroll headline is the month-over-month change in thousands of jobs,
  // not the ~159 million level.
  const payrollChangeNow = latest(periodChange(payrolls.observations));

  // Fail the build rather than render a hero with missing numbers.
  if (!inflationNow || !unemploymentNow || !mortgageNow || !payrollChangeNow) {
    throw new Error("Landing page requires current observations for hero figures");
  }

  const conditions: ConditionFigure[] = [
    {
      label: "Inflation (CPI, YoY)",
      value: formatPercent(inflationNow[1], 1),
      date: formatMonth(inflationNow[0]),
    },
    {
      label: "Unemployment rate",
      value: formatPercent(unemploymentNow[1], 1),
      date: formatMonth(unemploymentNow[0]),
    },
    {
      label: "30-year mortgage rate",
      value: formatPercent(mortgageNow[1], 2),
      date: formatObservationDate(mortgageNow[0], mortgage.frequency),
    },
    {
      label: "Payroll change (MoM)",
      value: `${formatSigned(payrollChangeNow[1], 0)}K`,
      date: formatMonth(payrollChangeNow[0]),
    },
  ];

  // --- Featured chart: inflation vs. wage growth since 2016. ---------------
  // Both series are 12-month percent changes, so they share a unit and the
  // vertical gap between them is real wage growth to a first approximation.
  const wageYoYSince2016 = since(yoyPercentChange(earnings.observations), "2016-01-01");
  const cpiYoYSince2016 = since(cpiYoY, "2016-01-01");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="pt-14 sm:pt-20" aria-label="Introduction">
        <p className="text-xs font-medium uppercase tracking-widest text-accent">
          Economic intelligence platform
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          From macroeconomic forces to household outcomes.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-secondary">
          Inflation, interest rates, employment, and housing shape every
          paycheck, mortgage, and grocery bill. EconOS traces those forces
          from the headline numbers down to what they mean for households,
          workers, and regions — with sourced data, visible uncertainty, and
          methods you can check.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/overview"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
          >
            Explore the economy
          </Link>
          <Link
            href="/simulator"
            className="rounded-md border border-hairline-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
          >
            Run a policy scenario
          </Link>
        </div>

        <div className="mt-12">
          <ConditionsStrip figures={conditions} />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* What EconOS answers                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-20" aria-label="What EconOS answers">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          What EconOS answers
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-secondary">
          Five layers, each built around a question people actually ask about
          the economy — from what is happening now to what would happen if
          policy changed.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LAYERS.map((layer) => (
            <LayerCard key={layer.href} {...layer} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Featured chart: inflation vs. wage growth                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-20" aria-label="Featured chart">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          The race that decides living standards
        </h2>
        <div className="mt-6">
          <TimeSeriesChart
            title="Inflation vs. wage growth since 2016"
            subtitle="12-month percent change in consumer prices and average hourly earnings"
            unit="% YoY"
            sourceLine={`Source: ${cpiAll.source} via FRED (${cpiAll.sourceId}, ${earnings.sourceId})`}
            description="Line chart comparing CPI inflation with average hourly earnings growth since 2016. Wage growth exceeded inflation before 2021, fell behind during the 2021 to 2022 inflation surge, and the two series have run close together since."
            series={[
              { name: "CPI inflation", data: cpiYoYSince2016, color: "1" },
              { name: "Wage growth", data: wageYoYSince2016, color: "2" },
            ]}
            zeroLine
          />
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-secondary">
          When the wage line runs above the price line, the average paycheck
          gains purchasing power; when the lines cross the other way, workers
          fall behind even as nominal pay rises. The gap between these two
          series — not either one alone — is what determines whether a typical
          worker is getting ahead, which is why EconOS always shows them
          together.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Methodology commitment                                             */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="mt-20 rounded-lg border border-hairline bg-surface-raised p-6 sm:p-8"
        aria-label="Methodology commitment"
      >
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          How we work
        </h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm font-semibold text-ink">Sourced data</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
              Every figure links to its originating agency and series ID.
              Nothing renders without provenance.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">Visible uncertainty</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
              Forecasts ship with intervals and a public track record, never a
              bare point estimate.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">No causal overreach</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
              Historical associations are labeled as associations. Causal
              claims require causal evidence.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">Reproducible pipelines</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
              Data snapshots, transformations, and formulas are versioned and
              documented end to end.
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-ink-secondary">
          Full sources, licenses, and known limitations are documented on the{" "}
          <Link
            href="/data"
            className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
          >
            Data &amp; Methods
          </Link>{" "}
          page.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* About strip                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="mt-14 flex flex-col gap-4 border-t border-hairline pt-8 sm:flex-row sm:items-start sm:justify-between"
        aria-label="About the author"
      >
        <div className="max-w-2xl">
          <h2 className="text-sm font-semibold text-ink">About EconOS</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            EconOS is built by Jean-Luc Saint-Fleur, an economist by training
            and a data &amp; analytics professional who builds data products.
            The platform is open source, and every page is generated from
            committed, validated data snapshots.
          </p>
        </div>
        <div className="flex shrink-0 gap-4 text-sm font-medium">
          <Link href="/about" className="text-accent hover:text-accent-strong">
            About
            <span aria-hidden="true"> →</span>
          </Link>
          <a
            href="https://github.com/jsaintfleur/EconOS"
            className="text-accent hover:text-accent-strong"
          >
            GitHub
            <span aria-hidden="true"> →</span>
          </a>
        </div>
      </section>
    </div>
  );
}
