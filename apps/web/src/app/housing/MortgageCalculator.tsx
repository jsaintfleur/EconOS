"use client";

import { useId, useState } from "react";
import { monthlyMortgagePayment } from "@/lib/econ";
import { formatDollars, formatNumber } from "@/lib/format";

/**
 * Mortgage payment calculator (client component).
 *
 * Defaults come from live data on the server page: the latest quarterly
 * median sales price (rounded to the nearest $1,000) and the latest weekly
 * 30-year fixed rate. All payment math goes through lib/econ:
 *
 *   monthlyMortgagePayment(P, r, n) = P · r(1+r)^n / ((1+r)^n − 1)
 *   with r = annual rate / 12, n = years × 12
 *
 * Derived outputs (documented display arithmetic on the library result):
 *   - Loan amount     = price × (1 − down payment %)
 *   - Total interest  = payment × months − loan
 *     (every dollar paid over the term beyond returning the principal)
 *   - Required income = payment × 12 ÷ 0.28
 *     (the 28% front-end rule: gross income such that the P&I payment is
 *     exactly 28% of monthly income — the conventional lending threshold)
 *   - Sensitivity     = the same payment formula at rate − 1pp and + 1pp
 *
 * Everything is principal & interest only — see the assumptions block.
 */

export interface MortgageCalculatorProps {
  /** Latest median sales price, rounded to $1,000 by the server page. */
  defaultPrice: number;
  /** Latest weekly 30-year fixed rate, percent. */
  defaultRatePct: number;
  /** Human-readable vintage labels for the defaults. */
  priceAsOf: string;
  rateAsOf: string;
}

/* Validation bounds — inputs outside these are clamped, not rejected. */
const PRICE_MIN = 50_000;
const PRICE_MAX = 10_000_000;
const DOWN_MIN = 0;
const DOWN_MAX = 95;
const RATE_MIN = 0.1;
const RATE_MAX = 15;

/** Front-end debt-to-income threshold used for the income requirement. */
const FRONT_END_RATIO = 0.28;

/** Parse a numeric field, falling back and clamping to sensible bounds. */
function clamp(raw: string, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || raw.trim() === "") return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function MortgageCalculator({
  defaultPrice,
  defaultRatePct,
  priceAsOf,
  rateAsOf,
}: MortgageCalculatorProps) {
  const priceId = useId();
  const downId = useId();
  const rateId = useId();
  const termId = useId();

  /* Raw strings in state so partial typing isn't clobbered; clamped
     numbers drive the math. Rate default keeps two decimals ("6.55"). */
  const [priceRaw, setPriceRaw] = useState(String(defaultPrice));
  const [downRaw, setDownRaw] = useState("20");
  const [rateRaw, setRateRaw] = useState(defaultRatePct.toFixed(2));
  const [termYears, setTermYears] = useState<15 | 30>(30);

  const price = clamp(priceRaw, defaultPrice, PRICE_MIN, PRICE_MAX);
  const downPct = clamp(downRaw, 20, DOWN_MIN, DOWN_MAX);
  const ratePct = clamp(rateRaw, defaultRatePct, RATE_MIN, RATE_MAX);

  /* Loan amount after the down payment. */
  const loan = price * (1 - downPct / 100);
  const months = termYears * 12;

  /* Monthly principal & interest via the standard amortization formula. */
  const payment = monthlyMortgagePayment(loan, ratePct, termYears);
  /* Total interest: everything paid over the term beyond the principal. */
  const totalInterest = payment * months - loan;
  /* 28% rule: annual gross income for which this payment is 28% of a month. */
  const requiredIncome = (payment * 12) / FRONT_END_RATIO;

  /* Rate sensitivity: identical loan at −1pp / current / +1pp. The low
     scenario is floored at the validation minimum so it stays meaningful. */
  const sensitivity = [
    { label: "−1 pp", rate: Math.max(RATE_MIN, ratePct - 1) },
    { label: "Current", rate: ratePct },
    { label: "+1 pp", rate: ratePct + 1 },
  ].map((s) => ({ ...s, payment: monthlyMortgagePayment(loan, s.rate, termYears) }));

  return (
    <div className="rounded-lg border border-hairline bg-surface p-5 sm:p-6">
      {/* ---------------- Inputs ---------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={priceId} className="block text-sm font-medium text-ink">
            Home price
          </label>
          <div className="relative mt-1.5">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
              $
            </span>
            <input
              id={priceId}
              type="number"
              inputMode="numeric"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={1000}
              value={priceRaw}
              onChange={(e) => setPriceRaw(e.target.value)}
              onBlur={() => setPriceRaw(String(price))}
              className="w-full rounded-md border border-hairline-strong bg-background py-2 pl-7 pr-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <p className="mt-1 text-xs text-muted">Median price, {priceAsOf}</p>
        </div>

        <div>
          <label htmlFor={downId} className="block text-sm font-medium text-ink">
            Down payment
          </label>
          <div className="relative mt-1.5">
            <input
              id={downId}
              type="number"
              inputMode="decimal"
              min={DOWN_MIN}
              max={DOWN_MAX}
              step={5}
              value={downRaw}
              onChange={(e) => setDownRaw(e.target.value)}
              onBlur={() => setDownRaw(String(downPct))}
              className="w-full rounded-md border border-hairline-strong bg-background py-2 pl-3 pr-8 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
              %
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">{formatDollars(price - loan)} down</p>
        </div>

        <div>
          <label htmlFor={rateId} className="block text-sm font-medium text-ink">
            Interest rate
          </label>
          <div className="relative mt-1.5">
            <input
              id={rateId}
              type="number"
              inputMode="decimal"
              min={RATE_MIN}
              max={RATE_MAX}
              step={0.125}
              value={rateRaw}
              onChange={(e) => setRateRaw(e.target.value)}
              onBlur={() => setRateRaw(ratePct.toFixed(2))}
              className="w-full rounded-md border border-hairline-strong bg-background py-2 pl-3 pr-8 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
              %
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">30-year average, week of {rateAsOf}</p>
        </div>

        <div>
          <label htmlFor={termId} className="block text-sm font-medium text-ink">
            Loan term
          </label>
          <select
            id={termId}
            value={termYears}
            onChange={(e) => setTermYears(Number(e.target.value) === 15 ? 15 : 30)}
            className="mt-1.5 w-full rounded-md border border-hairline-strong bg-background px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value={30}>30 years</option>
            <option value={15}>15 years</option>
          </select>
          <p className="mt-1 text-xs text-muted">Fixed rate, fully amortizing</p>
        </div>
      </div>

      {/* ---------------- Outputs ---------------- */}
      <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-hairline pt-5 sm:grid-cols-3" aria-live="polite">
        <div className="rounded-md bg-surface-raised p-4">
          <dt className="text-xs font-medium uppercase tracking-wider text-muted">
            Monthly payment (P&amp;I)
          </dt>
          <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-ink">
            {formatDollars(payment)}
          </dd>
          <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
            On a {formatDollars(loan)} loan at {formatNumber(ratePct, 2)}% over {termYears} years.
          </dd>
        </div>
        <div className="rounded-md bg-surface-raised p-4">
          <dt className="text-xs font-medium uppercase tracking-wider text-muted">
            Total interest over the loan
          </dt>
          <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-ink">
            {formatDollars(totalInterest)}
          </dd>
          <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
            All payments beyond repaying the principal, across {months} months.
          </dd>
        </div>
        <div className="rounded-md bg-surface-raised p-4">
          <dt className="text-xs font-medium uppercase tracking-wider text-muted">
            Income required (28% rule)
          </dt>
          <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-ink">
            {formatDollars(requiredIncome)}
          </dd>
          <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
            Annual gross income at which this payment is 28% of a month’s pay.
          </dd>
        </div>
      </dl>

      {/* ---------------- Rate sensitivity ---------------- */}
      <div className="mt-6 border-t border-hairline pt-5">
        <h3 className="text-sm font-medium text-ink">Payment sensitivity to the rate</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <caption className="sr-only">
              Monthly principal and interest payment at one percentage point below the
              chosen rate, at the chosen rate, and one percentage point above it
            </caption>
            <thead>
              <tr className="border-b border-hairline-strong text-left text-xs uppercase tracking-wider text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Scenario</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Rate</th>
                <th scope="col" className="py-2 text-right font-medium">Monthly P&amp;I</th>
              </tr>
            </thead>
            <tbody>
              {sensitivity.map((s) => (
                <tr key={s.label} className="border-b border-hairline last:border-b-0">
                  <th scope="row" className={`py-2 pr-4 text-left ${s.label === "Current" ? "font-medium text-ink" : "font-normal text-ink-secondary"}`}>
                    {s.label}
                  </th>
                  <td className="tabular py-2 pr-4 text-right text-ink-secondary">
                    {formatNumber(s.rate, 2)}%
                  </td>
                  <td className={`tabular py-2 text-right ${s.label === "Current" ? "font-medium text-ink" : "text-ink-secondary"}`}>
                    {formatDollars(s.payment)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- Assumptions ---------------- */}
      <p className="mt-5 border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
        <span className="font-medium text-ink-secondary">Assumptions.</span>{" "}
        Principal and interest only — excludes property taxes, homeowners
        insurance, mortgage insurance (typically required below 20% down), HOA
        dues, and closing costs, all of which raise the true monthly cost.
        Fixed rate, fully amortizing, no points or extra payments. The 28%
        front-end ratio is a conventional lending guideline, not financial
        advice. Inputs are clamped to {formatDollars(PRICE_MIN)}–{formatDollars(PRICE_MAX)},{" "}
        {DOWN_MIN}–{DOWN_MAX}% down, and {RATE_MIN}–{RATE_MAX}% rates.
      </p>
    </div>
  );
}
