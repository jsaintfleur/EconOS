# EconOS — Product Requirements (v1.0.0)

**Product owner:** Jean-Luc Saint-Fleur
**Status:** Active development
**Last updated:** 2026-07-18

## Mission

EconOS is an economic intelligence platform that connects macroeconomic forces to the
real-world outcomes experienced by households, workers, businesses, industries, and
regions. It answers what is happening in the U.S. economy, who is affected and by how
much, what economic theory says about the mechanisms, what may happen next, and what
would change under alternative scenarios.

The product is Jean-Luc Saint-Fleur's flagship economics portfolio project. It must
demonstrate applied economic reasoning, reproducible data engineering, validated
forecasting, honest treatment of uncertainty, and production-grade software craft.

## Product principles

1. Economic theory before decoration.
2. Transparency before artificial intelligence.
3. Reproducibility before complexity.
4. Decision usefulness before chart quantity.
5. Uncertainty must be visible.
6. Correlation must not be presented as causation.
7. Every insight must be traceable to data.
8. Every model must have a documented purpose.
9. Every page must answer a real economic question.
10. The product must remain understandable to a non-economist.

## Users

| User | Need | Primary surfaces |
| --- | --- | --- |
| Executive | Concise, trustworthy read on conditions and risks | Landing, Overview |
| Economist / analyst | Transparent methods, history, reproducibility | Research, Forecasts, Data & Methods |
| Business strategist | How conditions affect demand, costs, employment | Overview, Simulator, domain pages |
| Policy analyst | Household, labor, housing, distributional analysis | Inflation, Labor, Housing |
| Recruiter / hiring manager | Understand purpose and Jean-Luc's contribution in ≤2 min | Landing, About, README |

## Product layers

1. **Economic Observatory** — curated scorecard and domain pages (growth, inflation,
   labor, housing, rates, consumption, production) answering: what is happening, what
   changed, how unusual is it.
2. **Microeconomic Impact Lab** — purchasing-power calculator, mortgage-payment
   calculator, affordability analysis: who is affected and by how much.
3. **Economic Research Lab** — theory-driven modules (real wages, Okun's Law,
   Beveridge Curve, interest-rate transmission) with documented methodology and
   limitations.
4. **Forecast Center** — backtested forecasts (inflation, unemployment, payrolls)
   with baselines, prediction intervals, and error metrics.
5. **Economic Transmission Engine** — interactive interest-rate scenario tool that
   labels every output as direct calculation, historical association, model estimate,
   or user assumption.

## v1.0.0 scope

**In scope:** landing page; economic overview scorecard (~15 indicators); inflation &
purchasing power; labor market intelligence; housing & interest rates; research lab
with four complete modules; forecast center with three backtested targets; the
interest-rate transmission simulator; data & methodology center; about page; full
test suite; CI; Vercel deployment; complete documentation.

**Deferred beyond v1.0:** interactive regional map with state/metro comparison
(shipped as a fast-follow — requires Census/BLS regional ingestion at scale), causal
inference modules, additional shock scenarios (oil, tariffs, productivity), user
accounts and saved scenarios, deep-learning models.

Deferrals are recorded honestly in the roadmap; nothing deferred is presented as
existing.

## Non-negotiable quality gates

- Strict TypeScript, lint, unit tests, data validation, and production build all pass
  in CI.
- Every displayed series shows its source, identifier, unit, latest observation date,
  and retrieval date.
- Every forecast shows its baseline comparison, backtest error, and prediction
  intervals, with a statement that forecasts are estimates.
- No fabricated data anywhere; a source failure yields a stale-data state, never
  invented values.
- No green-equals-good coloring where interpretation is ambiguous (e.g., a falling
  policy rate is not "good" or "bad" per se).
- WCAG-aligned accessibility: keyboard navigation, semantic structure, chart
  descriptions, contrast, reduced motion.
- Educational-use disclaimer: EconOS does not provide financial or investment advice.
