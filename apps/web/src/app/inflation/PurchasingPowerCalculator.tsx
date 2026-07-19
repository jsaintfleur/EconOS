"use client";

import { useId, useState } from "react";
import { purchasingPower } from "@/lib/econ";
import { formatDollars, formatMonth, formatNumber, formatPercent } from "@/lib/format";

/**
 * Purchasing-power calculator (client component).
 *
 * The server page passes real CPI-U vintages as plain props:
 *   - `years`: annual-average CPI index for each selectable start year
 *     (mean of the twelve monthly values — the BLS annual-table convention)
 *   - `latestCpi`: the newest monthly index observation, used as "today"
 *
 * All economics goes through lib/econ's `purchasingPower(amount, cpiStart,
 * cpiEnd) = amount × cpiStart / cpiEnd`, applied in both directions:
 *
 *   1. Buying power of the unchanged budget, in start-year dollars:
 *      purchasingPower(budget, cpiStart, cpiToday)
 *      — the same dollars, deflated to what they would have bought then.
 *   2. Equivalent income needed today to match the start-year budget:
 *      purchasingPower(budget, cpiToday, cpiStart)
 *      — the identical identity with the index arguments swapped, which
 *      inflates the budget forward to today's price level.
 *   3. Cumulative price increase, displayed as a percent: derived from the
 *      ratio of (2) to the original budget, so no CPI arithmetic happens
 *      outside the library call.
 */

export interface YearlyCpi {
  year: number;
  /** Annual-average CPI-U index (1982–84 = 100). */
  avgCpi: number;
}

export interface PurchasingPowerCalculatorProps {
  years: YearlyCpi[];
  latestCpi: { date: string; value: number };
  sourceId: string;
  retrievedAt: string;
}

/* Validation bounds for the budget input. */
const BUDGET_MIN = 100;
const BUDGET_MAX = 1_000_000;
const BUDGET_DEFAULT = 4000;

/** Clamp a parsed budget to sensible bounds; empty/invalid → default. */
function clampBudget(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || raw.trim() === "") return BUDGET_DEFAULT;
  return Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, parsed));
}

export function PurchasingPowerCalculator({
  years,
  latestCpi,
  sourceId,
  retrievedAt,
}: PurchasingPowerCalculatorProps) {
  const budgetId = useId();
  const yearId = useId();

  /* The raw string is kept in state so intermediate typing states ("", "4")
     don't fight the user; the clamped numeric value drives the math. */
  const [budgetRaw, setBudgetRaw] = useState(String(BUDGET_DEFAULT));
  /* Default to 2019: the pre-pandemic baseline is the comparison people
     most often reach for. */
  const defaultYear = years.some((y) => y.year === 2019) ? 2019 : years[0].year;
  const [startYear, setStartYear] = useState(defaultYear);

  const budget = clampBudget(budgetRaw);
  const startEntry = years.find((y) => y.year === startYear) ?? years[0];

  /* (1) What the unchanged budget buys today, in start-year dollars. */
  const buyingPowerNow = purchasingPower(budget, startEntry.avgCpi, latestCpi.value);
  /* (2) Income needed today to match the start-year budget. */
  const equivalentIncome = purchasingPower(budget, latestCpi.value, startEntry.avgCpi);
  /* (3) Cumulative price increase — display-only derivation of the CPI ratio. */
  const cumulativeIncreasePct = (equivalentIncome / budget - 1) * 100;

  return (
    <div className="rounded-lg border border-hairline bg-surface p-5 sm:p-6">
      {/* ---------------- Inputs ---------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <div>
          <label htmlFor={budgetId} className="block text-sm font-medium text-ink">
            Monthly budget in {startEntry.year}
          </label>
          <div className="relative mt-1.5">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
              $
            </span>
            <input
              id={budgetId}
              type="number"
              inputMode="decimal"
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={100}
              value={budgetRaw}
              onChange={(e) => setBudgetRaw(e.target.value)}
              onBlur={() => setBudgetRaw(String(budget))}
              className="w-full rounded-md border border-hairline-strong bg-background py-2 pl-7 pr-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            Between {formatDollars(BUDGET_MIN)} and {formatDollars(BUDGET_MAX)}; out-of-range values are clamped.
          </p>
        </div>

        <div>
          <label htmlFor={yearId} className="block text-sm font-medium text-ink">
            Start year
          </label>
          <select
            id={yearId}
            value={startYear}
            onChange={(e) => setStartYear(Number(e.target.value))}
            className="mt-1.5 w-full rounded-md border border-hairline-strong bg-background px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {years.map((y) => (
              <option key={y.year} value={y.year}>
                {y.year}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Compared against the latest CPI reading ({formatMonth(latestCpi.date)}).
          </p>
        </div>
      </div>

      {/* ---------------- Outputs ---------------- */}
      <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-hairline pt-5 sm:grid-cols-3" aria-live="polite">
        <div className="rounded-md bg-surface-raised p-4">
          <dt className="text-xs font-medium uppercase tracking-wider text-muted">
            Buying power today
          </dt>
          <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-ink">
            {formatDollars(buyingPowerNow)}
          </dd>
          <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
            What the same {formatDollars(budget)} buys now, measured in{" "}
            {startEntry.year} dollars.
          </dd>
        </div>
        <div className="rounded-md bg-surface-raised p-4">
          <dt className="text-xs font-medium uppercase tracking-wider text-muted">
            Cumulative price increase
          </dt>
          <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-ink">
            {formatPercent(cumulativeIncreasePct, 1, true)}
          </dd>
          <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
            Rise in the overall CPI-U price level since the {startEntry.year} annual average.
          </dd>
        </div>
        <div className="rounded-md bg-surface-raised p-4">
          <dt className="text-xs font-medium uppercase tracking-wider text-muted">
            Equivalent income needed
          </dt>
          <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-ink">
            {formatDollars(equivalentIncome)}
          </dd>
          <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
            Monthly amount needed today to buy what {formatDollars(budget)} bought in {startEntry.year}.
          </dd>
        </div>
      </dl>

      {/* ---------------- Vintages & assumptions ---------------- */}
      <div className="mt-5 border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
        <p>
          <span className="font-medium text-ink-secondary">CPI vintages used.</span>{" "}
          {startEntry.year} annual average: {formatNumber(startEntry.avgCpi, 1)} ·{" "}
          {formatMonth(latestCpi.date)}: {formatNumber(latestCpi.value, 1)} (index,
          1982–84 = 100). BLS CPI-U via FRED ({sourceId}), retrieved {retrievedAt}.
        </p>
        <p className="mt-2">
          <span className="font-medium text-ink-secondary">Assumptions.</span>{" "}
          Uses the national CPI-U all-items basket for urban consumers,
          seasonally adjusted. Your own inflation rate depends on what you buy
          and where you live — renters, drivers, and households with large
          medical costs can differ substantially from this average.
        </p>
      </div>
    </div>
  );
}
