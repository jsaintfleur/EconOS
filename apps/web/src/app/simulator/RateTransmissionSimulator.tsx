"use client";

import { useId, useState } from "react";
import { monthlyMortgagePayment } from "@/lib/econ";
import {
  formatDollars,
  formatFullDate,
  formatPercent,
  formatQuarter,
  formatSigned,
} from "@/lib/format";
import type { Association, TransmissionAssociations } from "./associations";

/**
 * Interest-Rate Transmission Simulator (client).
 *
 * The user sets a hypothetical policy-rate change; the component walks that
 * change down the transmission chain, labeling every number with where it
 * came from. The provenance taxonomy is the core of the design:
 *
 *   [User assumption]        — the scenario the user chose; not data.
 *   [Historical association] — an OLS estimate from ../associations.ts, shown
 *                              with its window, lag, R², and judgment range.
 *   [Direct calculation]     — arithmetic with no estimation (amortization,
 *                              the 28% affordability rule).
 *   [Economic interpretation]— fixed prose about the mechanism.
 *
 * All estimation happened at build time on the server; this component only
 * multiplies user inputs by the received slopes and runs the exact mortgage
 * arithmetic from lib/econ. Nothing here is a forecast — every estimated
 * block says "historically associated with", never "will cause".
 */

interface SimulatorProps {
  associations: TransmissionAssociations;
  /** Latest observed 30-year mortgage rate (%), and its observation date. */
  currentMortgageRate: number;
  currentMortgageRateDate: string;
  /** Latest median new-home sales price ($), and its (quarterly) date. */
  medianHomePrice: number;
  medianHomePriceDate: string;
  /** Default loan: median price × 0.8 (a conventional 20% down payment). */
  defaultLoanAmount: number;
}

/** Provenance tag badge — every output block carries exactly one. */
type TagKind =
  | "User assumption"
  | "Historical association"
  | "Direct calculation"
  | "Economic interpretation";

function ProvenanceTag({ kind }: { kind: TagKind }) {
  // The user's own assumption is tinted with the accent so it is visually
  // distinct from anything derived from data; everything else stays neutral.
  const style =
    kind === "User assumption"
      ? "bg-accent-soft text-accent-strong"
      : "bg-surface-raised text-ink-secondary";
  return (
    <span
      className={`inline-flex rounded-sm px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${style}`}
    >
      {kind}
    </span>
  );
}

/** One step of the cascade: tag, heading, then whatever content follows. */
function CascadeBlock({
  tag,
  title,
  children,
}: {
  tag: TagKind;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceTag kind={tag} />
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Fine-print line describing an association's estimation pedigree. */
function EstimationNote({ association }: { association: Association }) {
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-muted">
      OLS on monthly data, {association.window}
      {association.lagMonths > 0
        ? `, driver lagged ${association.lagMonths} months`
        : ", contemporaneous"}
      {" · "}slope {association.slope.toFixed(2)} {association.slopeUnit}
      {" · "}R² {association.r2.toFixed(2)} · n = {association.n}
    </p>
  );
}

/** Sort a two-value judgment range so display is always low → high. */
function sortedRange(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

export function RateTransmissionSimulator({
  associations,
  currentMortgageRate,
  currentMortgageRateDate,
  medianHomePrice,
  medianHomePriceDate,
  defaultLoanAmount,
}: SimulatorProps) {
  // --- Controls -----------------------------------------------------------
  const [policyDelta, setPolicyDelta] = useState(1); // pp, −3 … +3
  const [loanAmount, setLoanAmount] = useState(Math.round(defaultLoanAmount));
  const [termYears, setTermYears] = useState<15 | 30>(30);
  const sliderId = useId();
  const loanId = useId();

  const { passThrough, housingStarts, newHomeSales, constructionEmployment, durables } =
    associations;

  // --- Step 1 → 2: implied mortgage-rate change ---------------------------
  // Historical association: pass-through slope × the user's policy change.
  const mortgageDelta = passThrough.slope * policyDelta;
  const [mortgageDeltaLow, mortgageDeltaHigh] = sortedRange(
    passThrough.slopeLow * policyDelta,
    passThrough.slopeHigh * policyDelta,
  );
  // Rates cannot go below zero in this simple scenario arithmetic.
  const newRate = Math.max(0, currentMortgageRate + mortgageDelta);
  const newRateLow = Math.max(0, currentMortgageRate + mortgageDeltaLow);
  const newRateHigh = Math.max(0, currentMortgageRate + mortgageDeltaHigh);

  // --- Step 3: the user's loan, exact arithmetic --------------------------
  const oldPayment = monthlyMortgagePayment(loanAmount, currentMortgageRate, termYears);
  const newPayment = monthlyMortgagePayment(loanAmount, newRate, termYears);
  const newPaymentLow = monthlyMortgagePayment(loanAmount, newRateLow, termYears);
  const newPaymentHigh = monthlyMortgagePayment(loanAmount, newRateHigh, termYears);
  const paymentDelta = newPayment - oldPayment;
  const paymentDeltaPct = oldPayment > 0 ? (paymentDelta / oldPayment) * 100 : NaN;
  // 28% front-end rule: gross income needed so the payment is 28% of monthly
  // income. The change in required income makes the affordability stakes
  // concrete without any further estimation.
  const requiredIncome = (payment: number) => (payment * 12) / 0.28;
  const incomeDelta = requiredIncome(newPayment) - requiredIncome(oldPayment);

  // --- Step 4: downstream activity, each with its own judgment range ------
  // The three housing-side outcomes respond to the mortgage-rate change; the
  // ranges apply each association's 0.5×–1.5× slope band to the central
  // mortgage-rate change from step 2 (upstream uncertainty compounds on top
  // of this — said explicitly in the interpretation block below).
  const downstream = [
    { association: housingStarts, input: mortgageDelta, inputName: "mortgage-rate change" },
    { association: newHomeSales, input: mortgageDelta, inputName: "mortgage-rate change" },
    { association: constructionEmployment, input: mortgageDelta, inputName: "mortgage-rate change" },
    // Durables were estimated directly against the policy rate.
    { association: durables, input: policyDelta, inputName: "policy-rate change" },
  ].map(({ association, input, inputName }) => {
    const central = association.slope * input;
    const [low, high] = sortedRange(association.slopeLow * input, association.slopeHigh * input);
    return { association, central, low, high, inputName };
  });

  return (
    <div className="space-y-4">
      {/* ---- Controls ---- */}
      <section className="rounded-lg border border-hairline bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Scenario controls</h2>
        <p className="mt-1 text-xs text-muted">
          Starting point: 30-year fixed mortgage rate {formatPercent(currentMortgageRate, 2)}{" "}
          (week of {formatFullDate(currentMortgageRateDate)}) · median new-home price{" "}
          {formatDollars(medianHomePrice)} ({formatQuarter(medianHomePriceDate)}). Estimates
          describe changes over a 12-month horizon.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {/* Policy-rate change slider */}
          <div className="sm:col-span-1">
            <label htmlFor={sliderId} className="text-xs font-medium text-ink-secondary">
              Policy-rate change
            </label>
            <p className="tabular mt-1 text-2xl font-semibold text-ink">
              {formatSigned(policyDelta, 2)}
              <span className="ml-1 text-sm font-normal text-muted">pp</span>
            </p>
            <input
              id={sliderId}
              type="range"
              min={-3}
              max={3}
              step={0.25}
              value={policyDelta}
              onChange={(event) => setPolicyDelta(Number(event.target.value))}
              className="mt-2 w-full accent-[var(--accent)]"
            />
            <div className="flex justify-between text-[11px] text-muted">
              <span>−3pp</span>
              <span>0</span>
              <span>+3pp</span>
            </div>
          </div>

          {/* Loan amount */}
          <div>
            <label htmlFor={loanId} className="text-xs font-medium text-ink-secondary">
              Mortgage amount
            </label>
            <input
              id={loanId}
              type="number"
              min={10000}
              max={10000000}
              step={10000}
              value={loanAmount}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) setLoanAmount(value);
              }}
              className="tabular mt-2 w-full rounded-md border border-hairline-strong bg-background px-3 py-2 text-sm text-ink"
            />
            <p className="mt-1 text-[11px] text-muted">
              Default: {formatDollars(defaultLoanAmount)} — 80% of the median new-home price
              (20% down payment).
            </p>
          </div>

          {/* Loan term */}
          <fieldset>
            <legend className="text-xs font-medium text-ink-secondary">Loan term</legend>
            <div className="mt-2 flex gap-2">
              {([15, 30] as const).map((years) => (
                <label
                  key={years}
                  className={`cursor-pointer rounded-md border px-4 py-2 text-sm ${
                    termYears === years
                      ? "border-hairline-strong bg-accent-soft font-medium text-accent-strong"
                      : "border-hairline text-ink-secondary hover:bg-surface-raised"
                  }`}
                >
                  <input
                    type="radio"
                    name="term"
                    value={years}
                    checked={termYears === years}
                    onChange={() => setTermYears(years)}
                    className="sr-only"
                  />
                  {years} years
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      {/* ---- Step 1: the assumption ---- */}
      <CascadeBlock tag="User assumption" title="Hypothetical policy-rate change">
        <p className="tabular text-2xl font-semibold text-ink">
          {formatSigned(policyDelta, 2)}
          <span className="ml-1 text-sm font-normal text-muted">pp over 12 months</span>
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          A scenario you chose — not a forecast of what the Federal Reserve will do.
        </p>
      </CascadeBlock>

      {/* ---- Step 2: pass-through to mortgage rates ---- */}
      <CascadeBlock tag="Historical association" title="Implied 30-year mortgage-rate change">
        <p className="tabular text-2xl font-semibold text-ink">
          {formatSigned(mortgageDelta, 2)}
          <span className="ml-1 text-sm font-normal text-muted">pp</span>
          <span className="tabular ml-3 text-sm font-normal text-ink-secondary">
            range {formatSigned(mortgageDeltaLow, 2)} to {formatSigned(mortgageDeltaHigh, 2)} pp
          </span>
        </p>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Historically, a 1pp change in the federal funds rate over 12 months has been
          associated with about a {passThrough.slope.toFixed(2)}pp same-direction move in the
          30-year mortgage rate. Applied to your scenario, the rate moves from{" "}
          {formatPercent(currentMortgageRate, 2)} to about {formatPercent(newRate, 2)} (range{" "}
          {formatPercent(Math.min(newRateLow, newRateHigh), 2)}–
          {formatPercent(Math.max(newRateLow, newRateHigh), 2)}).
        </p>
        <EstimationNote association={passThrough} />
      </CascadeBlock>

      {/* ---- Step 3: the user's loan ---- */}
      <CascadeBlock tag="Direct calculation" title="Monthly payment on your loan">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">At today&rsquo;s rate ({formatPercent(currentMortgageRate, 2)})</dt>
            <dd className="tabular mt-1 text-xl font-semibold text-ink">
              {formatDollars(oldPayment)}
              <span className="ml-1 text-xs font-normal text-muted">/mo</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">At the implied rate ({formatPercent(newRate, 2)})</dt>
            <dd className="tabular mt-1 text-xl font-semibold text-ink">
              {formatDollars(newPayment)}
              <span className="ml-1 text-xs font-normal text-muted">/mo</span>
            </dd>
            <dd className="tabular text-xs text-muted">
              range {formatDollars(Math.min(newPaymentLow, newPaymentHigh))}–
              {formatDollars(Math.max(newPaymentLow, newPaymentHigh))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Change</dt>
            <dd className="tabular mt-1 text-xl font-semibold text-ink">
              {paymentDelta >= 0 ? "+" : "−"}
              {formatDollars(Math.abs(paymentDelta))}
              <span className="ml-1 text-xs font-normal text-muted">
                /mo ({formatPercent(paymentDeltaPct, 1, true)})
              </span>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-secondary">
          Under the standard 28% front-end affordability rule, the gross annual income needed
          to carry this loan changes by{" "}
          <span className="tabular font-medium text-ink">
            {incomeDelta >= 0 ? "+" : "−"}
            {formatDollars(Math.abs(incomeDelta))}
          </span>
          .
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Standard fixed-rate amortization on a {formatDollars(loanAmount)} loan over{" "}
          {termYears} years — exact arithmetic, no estimation. The only estimated input is the
          mortgage rate from the previous step.
        </p>
      </CascadeBlock>

      {/* ---- Step 4: downstream activity ---- */}
      <CascadeBlock
        tag="Historical association"
        title="Historically associated 12-month changes in housing and spending"
      >
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {downstream.map(({ association, central, low, high, inputName }) => (
            <div key={association.id}>
              <dt className="text-xs font-medium text-ink-secondary">{association.outcome}</dt>
              <dd className="tabular mt-1 text-xl font-semibold text-ink">
                {formatPercent(central, 1, true)}
                <span className="tabular ml-2 text-sm font-normal text-ink-secondary">
                  range {formatPercent(low, 1, true)} to {formatPercent(high, 1, true)}
                </span>
              </dd>
              <dd className="mt-1 text-xs leading-relaxed text-muted">
                Applied to the {inputName} above · OLS {association.window}, driver lagged{" "}
                {association.lagMonths}m · R² {association.r2.toFixed(2)} · n = {association.n}
                {association.r2 < 0.05 &&
                  " — R² near zero: historically this driver explains almost none of the variation, so treat the point estimate as close to uninformative."}
              </dd>
            </div>
          ))}
        </dl>
      </CascadeBlock>

      {/* ---- Step 5: interpretation ---- */}
      <CascadeBlock tag="Economic interpretation" title="How to read this chain">
        <div className="space-y-3 text-sm leading-relaxed text-ink-secondary">
          <p>
            The mechanism runs through financing costs. A higher policy rate raises the cost of
            funds across the yield curve; mortgage rates reprice; monthly payments on new loans
            rise; fewer households clear the affordability bar at prevailing prices; builders
            respond to thinner demand by starting fewer homes; and, with a longer delay, hiring
            in construction and spending on big-ticket durables adjust. Each arrow in that
            story is plausible economics — but each estimated link above is an association
            drawn from history, not a measured causal effect, because the Federal Reserve moves
            rates in response to the very conditions these outcomes reflect.
          </p>
          <p>
            Uncertainty widens as the chain gets longer. The pass-through step is the
            tightest link; the housing-activity steps depend on that estimate and add their
            own much weaker fits; the employment and durables links are close to
            uninformative on their own. The displayed ranges apply each step&rsquo;s 0.5×–1.5×
            judgment band to the central input from the step before, so the true compound
            uncertainty is wider than any single range shown. Treat the cascade as a
            structured way to think, not a prediction machine.
          </p>
        </div>
      </CascadeBlock>
    </div>
  );
}
