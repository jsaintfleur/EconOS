import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Provenance } from "@/components/ui/Provenance";
import { getSeries } from "@/lib/data";
import { formatPercent, formatQuarter } from "@/lib/format";
import { FindingStats, ModuleSection, ReproduceSection } from "../module-sections";
import { ScatterChart, type ScatterFitLine, type ScatterGroup } from "../ScatterChart";
import { okunResults, type OkunFit, type OkunPoint } from "./okun";

/**
 * /research/okuns-law — Do recessions destroy jobs one-for-one with output?
 *
 * Okun's law is the empirical regularity linking output growth to
 * unemployment changes. All estimation lives in ./okun.ts (shared with the
 * research index); this page presents the scatter, the fitted lines, and
 * what the coefficient does and does not mean.
 */

export const metadata: Metadata = {
  title: "Okun's law · Research",
  description:
    "Do recessions destroy jobs one-for-one with output? Quarterly unemployment changes against real GDP growth since 1960 — the Okun coefficient, the growth rate that holds unemployment steady, and how the relationship has drifted.",
};

/** Fit-line endpoints spanning a point set's x-range: y = a + b·x. */
function fitEndpoints(fit: OkunFit, points: OkunPoint[]): ScatterFitLine["from"][] {
  const xs = points.map((p) => p.growth);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  return [
    { x: xMin, y: fit.intercept + fit.slope * xMin },
    { x: xMax, y: fit.intercept + fit.slope * xMax },
  ];
}

export default function OkunsLawPage() {
  const gdp = getSeries("real_gdp_growth");
  const unemployment = getSeries("unemployment_rate");
  const { points, full, early, late, stableGrowthRate } = okunResults;

  // Scatter groups: the two subperiods used for the stability check, so the
  // drift in the relationship is visible in the same picture as the fit.
  const earlyPoints = points.filter((p) => p.date < "1990-01-01");
  const latePoints = points.filter((p) => p.date >= "1990-01-01");
  const toScatter = (subset: OkunPoint[]) =>
    subset.map((p) => ({ x: p.growth, y: p.unemploymentChange, label: formatQuarter(p.date) }));

  const groups: ScatterGroup[] = [
    { name: `Quarters ${early.window}`, color: "3", points: toScatter(earlyPoints) },
    { name: `Quarters ${late.window}`, color: "1", points: toScatter(latePoints) },
  ];

  const [fullFrom, fullTo] = fitEndpoints(full, points);
  const fitLines: ScatterFitLine[] = [
    { name: `OLS fit ${full.window}`, color: "2", from: fullFrom, to: fullTo },
  ];

  // Per-year restatement of the quarterly coefficient: a growth shortfall
  // sustained for four quarters accumulates roughly 4× the quarterly effect.
  const annualizedEffect = full.slope * 4;

  return (
    <div className="pb-16">
      <PageHeader
        question="Do recessions destroy jobs one-for-one with output?"
        title="Okun's law"
        lede="Arthur Okun's 1962 observation — that unemployment rises when output grows too slowly — is one of the most durable regularities in macroeconomics. This module estimates it from sixty-five years of quarterly data and checks whether the coefficient has stayed put."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ModuleSection title="Question">
          <p>
            How tightly are output growth and unemployment linked — and how fast does the
            economy have to grow just to keep the unemployment rate from rising?
          </p>
        </ModuleSection>

        <ModuleSection title="Theory">
          <p>
            Production requires labor, so falling output should mean fewer jobs. But the
            mapping is not one-for-one: firms hoard trained workers through downturns, hours
            and productivity absorb part of every shock, and the labor force itself grows and
            shrinks with opportunity. Okun&rsquo;s law summarizes the net result as a linear rule:
            ΔU = a + b·g, where g is real GDP growth and b — the Okun coefficient — is
            expected to be negative and well below one in magnitude. The intercept matters
            too: because productivity and the labor force trend upward, zero growth is not
            enough to hold unemployment steady; the break-even growth rate is −a/b.
          </p>
        </ModuleSection>

        <ModuleSection title="Data">
          <p>
            Real GDP growth (quarterly, % at a seasonally adjusted annual rate, as published)
            and the civilian unemployment rate (monthly, averaged within each quarter and
            then first-differenced). The sample runs from 1960 through {formatQuarter(points[points.length - 1].date)},{" "}
            {full.n} quarters. The quarter containing the missing October 2025 unemployment
            release is averaged over its two available months — a documented approximation.
          </p>
          <div className="space-y-1">
            <Provenance snapshot={gdp} />
            <Provenance snapshot={unemployment} />
          </div>
        </ModuleSection>

        <ModuleSection title="Method">
          <p>
            Ordinary least squares of the quarterly change in the unemployment rate on
            published real GDP growth. The scatter below colors quarters by subperiod; the
            fitted line is the full-sample estimate. Because growth is quoted at an annual
            rate while the unemployment change is per quarter, the slope reads as
            “percentage points of unemployment per quarter, per 1pp of annualized growth.”
          </p>
          <ScatterChart
            title="Okun's law, 1960–present"
            subtitle="Each point is one quarter; line is the full-sample OLS fit"
            xLabel="Real GDP growth (% SAAR)"
            yLabel="Change in unemployment rate (pp)"
            xUnit="% SAAR"
            yUnit="pp"
            sourceLine={`BEA Real GDP & BLS Unemployment Rate via FRED · ${full.window} · EconOS estimation`}
            description={`Scatter plot of quarterly unemployment-rate changes against real GDP growth since 1960, with a downward-sloping fitted line. The slope is ${full.slope.toFixed(2)} percentage points per point of annualized growth, and the cloud is tighter around the line in the post-1990 subperiod. Extreme pandemic quarters in 2020 sit far from the main cluster.`}
            groups={groups}
            fitLines={fitLines}
          />
        </ModuleSection>

        <ModuleSection title="Findings">
          <div>
            <FindingStats
              items={[
                {
                  label: "Okun coefficient",
                  value: full.slope.toFixed(2),
                  detail: `pp of unemployment per quarter, per 1pp of annualized growth (R² ${full.r2.toFixed(2)}, n = ${full.n}). Roughly ${annualizedEffect.toFixed(1)}pp per year if the growth gap persists.`,
                },
                {
                  label: "Break-even growth",
                  value: formatPercent(stableGrowthRate, 1),
                  detail: "SAAR growth historically consistent with a stable unemployment rate (−intercept/slope). Slower growth than this has typically meant rising unemployment.",
                },
                {
                  label: "Coefficient drift",
                  value: `${early.slope.toFixed(2)} → ${late.slope.toFixed(2)}`,
                  detail: `${early.window} vs. ${late.window} (R² ${early.r2.toFixed(2)} vs. ${late.r2.toFixed(2)}). The output–unemployment link has grown stronger, not weaker.`,
                },
              ]}
            />
          </div>
          <p>
            The answer to the headline question is no — far from one-for-one. A quarter of
            growth 1pp (annualized) below the break-even pace has historically come with only
            about {Math.abs(full.slope).toFixed(2)}pp of extra unemployment; sustained for a
            year, roughly {Math.abs(annualizedEffect).toFixed(1)}pp. Labor hoarding, hours
            cuts, and participation flows absorb most of an output shock before the
            unemployment rate moves. The break-even growth rate of about{" "}
            {formatPercent(stableGrowthRate, 1)} also means “positive growth” and “healthy
            labor market” are different claims: an economy growing at 2% has, for most of
            this sample, been one where unemployment drifts up.
          </p>
        </ModuleSection>

        <ModuleSection title="Uncertainty">
          <p>
            The full-sample fit leaves nearly half the quarter-to-quarter variation
            unexplained (R² {full.r2.toFixed(2)}), so the line is a tendency, not a rule for
            any single quarter. The 2020 pandemic quarters are extreme outliers that pull on
            any least-squares line — growth near −30% and +35% SAAR with double-digit
            unemployment swings — and the coefficient shifts visibly at the tenths level
            depending on whether such episodes are in the window. The subperiod estimates
            ({early.slope.toFixed(2)} before 1990, {late.slope.toFixed(2)} after) bound how
            much the “true” coefficient has moved.
          </p>
        </ModuleSection>

        <ModuleSection title="Limitations">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-ink">The coefficient is not structural.</span>{" "}
              It drifts across decades — with demographics, labor-market institutions, and
              the industry mix — so extrapolating any single estimate far out of sample is
              unreliable by construction.
            </li>
            <li>
              <span className="font-medium text-ink">Demand vs. supply shocks.</span>{" "}
              Okun&rsquo;s law describes demand-driven cycles. Supply shocks (an oil shock, a
              pandemic reopening) move output and unemployment in patterns the linear rule
              does not capture, and the relationship says nothing about which shock is under
              way.
            </li>
            <li>
              <span className="font-medium text-ink">Association, not mechanism.</span>{" "}
              Output and employment are determined together; the regression describes their
              historical co-movement and cannot say that a policy that raises measured GDP
              growth would lower unemployment by the slope.
            </li>
          </ul>
        </ModuleSection>

        <ReproduceSection modulePath="apps/web/src/app/research/okuns-law/page.tsx (estimation in okun.ts)" />
      </div>
    </div>
  );
}
