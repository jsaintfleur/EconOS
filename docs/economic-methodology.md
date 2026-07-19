# EconOS — Economic Methodology

Last updated: 2026-07-18

This document defines how EconOS computes, interprets, and presents economic
measures. Every formula used in the application is implemented in
`apps/web/src/lib/econ.ts` and covered by unit tests.

## Core transformations

**Year-over-year percent change** (inflation, wage growth, spending growth):

```
yoy_t = (X_t / X_{t-12m} − 1) × 100
```

Used for monthly indices (CPI, average hourly earnings, retail sales). For
quarterly series the lag is 4 quarters.

**Real GDP growth** is taken directly from BEA's published quarter-over-quarter
seasonally adjusted annualized rate (FRED: `A191RL1Q225SBEA`) rather than
recomputed, to match the headline figure users see elsewhere.

**Real wage growth**: nominal wage growth minus CPI inflation over the same
window, i.e. `real ≈ yoy(AHE) − yoy(CPI)`. This first-order approximation is
standard for small rates; the exact ratio form `((1+w)/(1+π)−1)` is used in the
purchasing-power calculator where compounding matters.

**Payroll change**: month-over-month change in total nonfarm employment
(thousands of jobs), the same measure reported in the monthly Employment
Situation.

**Historical percentile**: for each scorecard indicator we report the percentile
of the latest value within its full published history (or a stated window). This
answers "how unusual is this?" without imposing a good/bad judgment.

## Interpretation rules

- **No mechanical good/bad coloring.** Direction arrows show the sign of the
  change. Color is applied only where the welfare interpretation is
  unambiguous within our framing (e.g., higher unemployment = deteriorating
  labor market). Rates, yields, and policy variables are presented neutrally.
- **Levels vs. rates vs. contributions are always labeled.** A card never mixes
  a level ("payrolls: 159.8M") with its change ("+147k") without labeling both.
- **Seasonal adjustment status is displayed** for every series.
- **Revisions**: FRED serves the latest revised vintages. EconOS displays
  current-vintage data and says so; real-time (first-release) analysis is out of
  scope for v1.0 and noted as a limitation.

## Labor-market tightness

Tightness is measured as the vacancy-to-unemployment ratio **V/U** = job
openings (JOLTS, level) ÷ unemployed persons (CPS, level). V/U ≈ 1 means one
opening per unemployed person. This is the standard tightness measure in the
search-and-matching literature (Diamond–Mortensen–Pissarides) and is the basis
of the Beveridge Curve module.

## Housing Affordability Index

EconOS defines a transparent payment-to-income affordability measure:

```
monthly_payment = P&I on the median existing-home sale price
                  with 20% down, 30-year fixed at the current average rate
affordability   = (median_family_income / 12) × 0.28 / monthly_payment × 100
```

An index of 100 means the qualifying-income rule (28% front-end ratio) is
exactly met at the median; above 100 means the median family can afford the
median home under these assumptions. This follows the spirit of the NAR
Housing Affordability Index but with fully disclosed assumptions (down payment,
term, ratio) that users can change in the calculator. Limitations: ignores
taxes, insurance, PMI, credit access, and regional price/income mismatch.

## Composite indices

Composite indicators (Economic Momentum Index, Household Pressure Index)
follow one construction rule set:

1. Components are chosen for economic relevance, published cadence, and history.
2. Each component is transformed to a comparable orientation and scale
   (z-scores against a stated historical window).
3. Weights are equal unless a documented reason justifies otherwise; weights
   are printed next to the index.
4. Sensitivity: the index is also computed leave-one-out to show component
   influence.
5. The index is presented as a summary of pressure/momentum, not a verdict.

## Causal language policy

EconOS reports associations, historical relationships, and model estimates. The
word "effect" appears only with an explicit basis: a direct calculation (e.g.,
mortgage payment arithmetic), a documented elasticity range from published
literature, or an estimated coefficient with stated assumptions. v1.0 includes
no formal causal-identification module; research pages state this in their
limitations sections.
