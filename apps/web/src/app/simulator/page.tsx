import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Provenance } from "@/components/ui/Provenance";
import { getSeries } from "@/lib/data";
import { latest } from "@/lib/econ";
import { RateTransmissionSimulator } from "./RateTransmissionSimulator";
import { transmissionAssociations, type Association } from "./associations";

/**
 * /simulator — Interest-Rate Transmission Engine.
 *
 * Server component: loads the latest observed mortgage rate and median home
 * price at build time, pulls the module-scope association estimates from
 * ./associations.ts, and hands everything to the client simulator as plain
 * serializable props. The page itself carries the honesty apparatus — the
 * assumptions section and the model-provenance table — so the caveats are in
 * the document even before any interaction happens.
 */

export const metadata: Metadata = {
  title: "Rate Transmission Simulator",
  description:
    "Trace a hypothetical policy-rate change through mortgage rates, monthly payments, and housing activity — with every number labeled by where it came from.",
};

/** Ordered rows for the model-provenance table. */
const ASSOCIATION_ROWS: Association[] = [
  transmissionAssociations.passThrough,
  transmissionAssociations.housingStarts,
  transmissionAssociations.newHomeSales,
  transmissionAssociations.constructionEmployment,
  transmissionAssociations.durables,
];

export default function SimulatorPage() {
  // Latest observed starting conditions for the scenario.
  const mortgage = getSeries("mortgage_30y");
  const medianPrice = getSeries("median_home_price");
  const latestMortgage = latest(mortgage.observations);
  const latestPrice = latest(medianPrice.observations);
  if (!latestMortgage || !latestPrice) {
    // Snapshots are zod-validated with ≥8 observations, so this cannot occur
    // in a passing build — the throw documents the invariant.
    throw new Error("simulator requires mortgage_30y and median_home_price observations");
  }
  const [mortgageDate, mortgageRate] = latestMortgage;
  const [priceDate, priceValue] = latestPrice;
  // Default loan: conventional 20% down on the median new home.
  const defaultLoanAmount = priceValue * 0.8;

  return (
    <div className="pb-16">
      <PageHeader
        question="What would a rate change mean for housing?"
        title="Interest-Rate Transmission Simulator"
        lede="Choose a hypothetical change in the federal funds rate and follow it down the chain — mortgage rates, the payment on a real loan, and the housing activity that has historically moved with financing costs. Every number is tagged with its provenance, and every estimate carries a visible range."
      />

      <div className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <RateTransmissionSimulator
          associations={transmissionAssociations}
          currentMortgageRate={mortgageRate}
          currentMortgageRateDate={mortgageDate}
          medianHomePrice={priceValue}
          medianHomePriceDate={priceDate}
          defaultLoanAmount={defaultLoanAmount}
        />

        {/* ---- Assumptions & limitations ---- */}
        <section className="mt-10 rounded-lg border border-hairline bg-surface p-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            Assumptions &amp; limitations
          </h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-ink-secondary">
            <li>
              <span className="font-medium text-ink">
                These are associations, not causal effects.
              </span>{" "}
              Monetary policy is endogenous: the Federal Reserve raises rates when the economy
              is running hot and cuts them when it weakens, so historical rate changes coincide
              with the very conditions that were already moving housing and spending. A
              regression over that history cannot separate the effect of the rate change from
              the effect of the conditions that prompted it.
            </li>
            <li>
              <span className="font-medium text-ink">Pass-through varies by regime.</span>{" "}
              How much of a policy move reaches mortgage rates depends on whether the move was
              expected, how the Fed communicates, and conditions in the mortgage-backed
              securities market. A single slope estimated over 1990–2026 averages across very
              different regimes — including years at the zero lower bound and the 2022 tightening,
              when mortgage rates moved far more than the historical average pass-through implies.
            </li>
            <li>
              <span className="font-medium text-ink">Ranges are judgment overlays.</span> The
              low–high bands shown are 0.5× to 1.5× the point estimate — a deliberate honesty
              device, not a statistical confidence interval. They exist to keep the weakness of
              simple two-variable regressions visible, and the compound uncertainty across
              chained steps is wider than any single band.
            </li>
            <li>
              <span className="font-medium text-ink">The horizon is fixed at 12 months.</span>{" "}
              All associations are estimated on 12-month changes; the simulator says nothing
              about the first weeks after a policy move or about effects beyond a year.
            </li>
            <li>
              The estimation methodology, charts of the underlying relationships, and a fuller
              discussion of timing and endogeneity live in{" "}
              <Link
                href="/research/rate-transmission"
                className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
              >
                the rate-transmission research module
              </Link>
              .
            </li>
          </ul>
        </section>

        {/* ---- Model provenance table ---- */}
        <section className="mt-6 rounded-lg border border-hairline bg-surface p-6">
          <h2 className="font-display text-xl font-semibold text-ink">Model provenance</h2>
          <p className="mt-2 text-sm text-ink-secondary">
            Every estimated relationship used above, re-estimated from the committed data
            snapshots on each build. Slopes are per 1pp change in the driver.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline-strong text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">Relationship</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Window</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Lag</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Slope</th>
                  <th scope="col" className="py-2 pr-4 font-medium">R²</th>
                  <th scope="col" className="py-2 font-medium">n</th>
                </tr>
              </thead>
              <tbody>
                {ASSOCIATION_ROWS.map((row) => (
                  <tr key={row.id} className="border-b border-hairline align-top">
                    <td className="py-2.5 pr-4 text-ink-secondary">{row.relationship}</td>
                    <td className="tabular py-2.5 pr-4 text-ink-secondary">{row.window}</td>
                    <td className="tabular py-2.5 pr-4 text-ink-secondary">
                      {row.lagMonths > 0 ? `${row.lagMonths}m` : "0m"}
                    </td>
                    <td className="tabular py-2.5 pr-4 text-ink">
                      {row.slope.toFixed(2)}{" "}
                      <span className="text-xs text-muted">{row.slopeUnit}</span>
                    </td>
                    <td className="tabular py-2.5 pr-4 text-ink-secondary">{row.r2.toFixed(2)}</td>
                    <td className="tabular py-2.5 text-ink-secondary">{row.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Source data provenance ---- */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-ink">Source series</h2>
          <div className="mt-2 space-y-1">
            {[
              "fed_funds",
              "mortgage_30y",
              "housing_starts",
              "new_home_sales",
              "construction_employment",
              "pce_durables",
              "median_home_price",
            ].map((id) => {
              const snapshot = getSeries(id);
              return (
                <div key={id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs text-ink-secondary">{snapshot.title}:</span>
                  <Provenance snapshot={snapshot} />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
