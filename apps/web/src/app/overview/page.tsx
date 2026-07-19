import type { Metadata } from "next";
import Link from "next/link";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSeries } from "@/lib/data";
import { since, yoyPercentChange } from "@/lib/econ";
import { getOverviewSections } from "./metrics";

/**
 * Economic overview — the scorecard page.
 *
 * Answers one question: "What is happening in the U.S. economy?" Roughly
 * fifteen indicators are grouped into the four blocks an economist would
 * check first — growth, prices, labor, and rates/housing — each card carrying
 * its own definition, historical percentile, and provenance. Static page:
 * every number is computed at build time from committed snapshots.
 */

export const metadata: Metadata = {
  title: "Economic Overview",
  description:
    "A scorecard of the U.S. economy: growth, inflation, wages, labor markets, interest rates, and housing — every figure sourced, dated, and placed in historical context.",
};

export default function OverviewPage() {
  const sections = getOverviewSections();

  // Chart inputs. Both charts start at 2000 so they share a time frame and
  // cover two full business cycles plus the pandemic shock — enough context
  // to judge whether today's readings are unusual.
  const unemployment = getSeries("unemployment_rate");
  const cpiAll = getSeries("cpi_all");
  const cpiCore = getSeries("cpi_core");
  const unemploymentSince2000 = since(unemployment.observations, "2000-01-01");
  // YoY is computed on the full index history first so early-2000 readings
  // have their 1999 base months, then trimmed for display.
  const cpiAllYoYSince2000 = since(yoyPercentChange(cpiAll.observations), "2000-01-01");
  const cpiCoreYoYSince2000 = since(yoyPercentChange(cpiCore.observations), "2000-01-01");

  return (
    <>
      <PageHeader
        question="What is happening in the U.S. economy?"
        title="Economic overview"
        lede="Sixteen indicators, four questions: is the economy growing, what are prices and paychecks doing, who is working, and what does money cost? Every figure is sourced, dated, and ranked against its own history."
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* Scorecard sections */}
        {sections.map((section) => (
          <section key={section.heading} className="mt-10" aria-label={section.heading}>
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted">
              {section.heading}
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {section.metrics.map(({ key, ...cardProps }) => (
                <MetricCard key={key} {...cardProps} />
              ))}
            </div>
          </section>
        ))}

        {/* Historical context charts */}
        <section className="mt-14" aria-label="Historical context">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted">
            Historical context
          </h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <TimeSeriesChart
              title="Unemployment rate since 2000"
              subtitle="Share of the labor force out of work and searching"
              unit="%"
              sourceLine={`Source: ${unemployment.source} via FRED (${unemployment.sourceId})`}
              description="Line chart of the U.S. unemployment rate since 2000, showing peaks near 10% after the 2008 financial crisis and near 15% during the 2020 pandemic shock, with recent readings close to 4%."
              series={[
                {
                  name: "Unemployment rate",
                  data: unemploymentSince2000,
                  color: "1",
                },
              ]}
            />
            <TimeSeriesChart
              title="Headline vs. core inflation since 2000"
              subtitle="12-month percent change in consumer prices"
              unit="% YoY"
              sourceLine={`Source: ${cpiAll.source} via FRED (${cpiAll.sourceId}, ${cpiCore.sourceId})`}
              description="Line chart comparing headline CPI inflation with core CPI inflation, which excludes food and energy, since 2000. Headline swings more widely around core, including the 2021 to 2022 surge above 8% and the subsequent decline."
              series={[
                { name: "CPI, all items", data: cpiAllYoYSince2000, color: "1" },
                {
                  name: "Core CPI (ex food & energy)",
                  data: cpiCoreYoYSince2000,
                  color: "2",
                  dashed: true,
                },
              ]}
              zeroLine
            />
          </div>
        </section>

        {/* Reading notes */}
        <section
          className="mt-14 rounded-lg border border-hairline bg-surface-raised p-6"
          aria-label="How to read this page"
        >
          <h2 className="text-sm font-semibold text-ink">How to read this page</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
            All figures are current-vintage: they reflect the latest published
            values, including any revisions to earlier periods, as of the date
            each series was retrieved. Seasonal adjustment varies by series and
            is noted on each source page — most monthly indicators here are
            seasonally adjusted, while market rates and consumer sentiment are
            not. Percentile lines rank the latest reading against that
            indicator&apos;s full published history, not against a fixed common
            window. Full source detail, licenses, and known limitations for
            every series are documented on the{" "}
            <Link
              href="/data"
              className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
            >
              Data &amp; Methods
            </Link>{" "}
            page.
          </p>
        </section>
      </div>
    </>
  );
}
