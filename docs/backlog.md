# EconOS — Delivery Backlog

Ticket statuses: `todo`, `in-progress`, `done`, `deferred (post-v1.0)`.
Each ticket lists objective, rationale, dependencies, and acceptance criteria.
Last updated: 2026-07-18.

## Phase 1 — Foundation

### ECONOS-001 — Repository foundation `done`
Initialize monorepo: license, README, changelog, contributing, security policy,
`.env.example`, gitignore, directory structure.
**Acceptance:** repo clones clean; standards files present; no secrets.

### ECONOS-002 — Design system and application shell `done`
Next.js App Router app with strict TypeScript and Tailwind; design tokens
(premium neutral palette, typographic scale); global navigation (Overview,
Inflation, Labor, Housing, Research, Forecasts, Simulator, Data, About); footer
with disclaimer; light/dark support; mobile navigation.
**Depends on:** 001. **Acceptance:** all routes reachable; no horizontal mobile
overflow; keyboard-navigable; typecheck passes.

## Phase 2 — Data platform

### ECONOS-003 — Data-source registry `done`
`data/metadata/series_registry.json`: every series with internal name, display
name, source, original identifier, source URL, frequency, unit, seasonal
adjustment, geography, transformation, license, limitations.
**Acceptance:** registry validates against schema; app reads catalog from it.

### ECONOS-004 — FRED ingestion pipeline `done`
Keyless retrieval via `fredgraph.csv`; per-series JSON snapshots with retrieval
date and latest-observation date; failure handling preserves last validated
snapshot and marks staleness.
**Acceptance:** one command refreshes all series; partial failures do not
corrupt outputs.

### ECONOS-005 — BLS ingestion pipeline `todo`
Direct BLS series where FRED mirrors are insufficient (occupation/industry
detail). v1.0 uses BLS-originated series mirrored on FRED; direct BLS API
ingestion is a fast-follow.

### ECONOS-006 — BEA ingestion pipeline `todo`
Direct BEA regional accounts for the regional module. v1.0 uses BEA-originated
national series mirrored on FRED; direct BEA API ingestion ships with the
regional module.

### ECONOS-007 — Data validation framework `done`
Schema checks, type checks, duplicate/missing detection, date continuity,
allowed ranges, output row counts; runs in CI.
**Acceptance:** validation fails the build on violation; all checks documented.

## Phase 3 — Observatory

### ECONOS-008 — Economic overview `done`
Curated scorecard: real GDP growth, CPI, core CPI, unemployment, payrolls,
participation, wage growth, fed funds, 10Y yield, yield curve spread, mortgage
rate, consumer sentiment, retail sales, housing starts, industrial production.
Each card: latest, previous, change, percentile context, date, source,
definition, interpretation.
**Acceptance:** all values from committed snapshots; no ambiguous good/bad
coloring; freshness visible.

### ECONOS-009 — Inflation and purchasing-power module `done`
Headline vs core CPI, category breakdown, wage-vs-price comparison, real wage
trend, household purchasing-power calculator.

### ECONOS-010 — Labor market module `done`
Unemployment, participation, payrolls, openings, quits, hires, claims, wage
growth; labor-market tightness (V/U); Beveridge Curve view.

### ECONOS-011 — Housing affordability module `done`
Mortgage rates, prices, income, permits, starts, sales; documented Housing
Affordability Index; mortgage-payment calculator; rate sensitivity.

### ECONOS-012 — Regional comparison module `deferred (post-v1.0)`
Interactive state/metro map and comparison. Deferred: requires regional
ingestion at scale (ECONOS-005/006). Roadmap item for v1.1.

### ECONOS-013 — Economic Momentum Index `todo`
Transparent composite of validated indicators with documented normalization and
sensitivity notes.

### ECONOS-014 — Household Pressure Index `todo`
Composite of inflation, real wages, housing costs, unemployment risk with
documented methodology.

## Phase 4 — Research Lab

### ECONOS-015 — Research Lab framework `done`
Module template: question, theory, variables, sources, method, findings,
uncertainty, limitations, code reference.

### ECONOS-016 — Okun's Law study `done`
### ECONOS-017 — Beveridge Curve study `done`
### ECONOS-018 — Real wage study `done`
### ECONOS-019 — Interest-rate transmission research `done`

## Phase 5 — Forecast Center

### ECONOS-020 — Forecasting framework `done`
Rolling-origin backtesting harness; MAE/RMSE/directional accuracy; interval
coverage; JSON forecast artifacts with model version and training window.

### ECONOS-021 — Inflation forecast `done`
### ECONOS-022 — Unemployment forecast `done`
### ECONOS-023 — Payroll growth forecast `done`
### ECONOS-024 — Forecast evaluation interface `done`
Fan charts, baseline-vs-model tables, backtest history, limitations.

## Phase 6 — Transmission Engine

### ECONOS-025 — Interest-rate scenario engine `done`
Controls: starting rate, rate change, horizon, mortgage amount, term. Outputs:
payment impact (direct calculation), affordability change, housing activity,
construction, employment, spending effects (historical associations) with
uncertainty ranges and provenance labels.

## Phase 7 — Hardening and content

### ECONOS-026 — Methodology and data center `done`
### ECONOS-027 — About Jean-Luc `done`
### ECONOS-028 — Accessibility audit `todo`
### ECONOS-029 — Performance audit `todo`
### ECONOS-030 — Documentation completion `todo`

## Phase 8 — Release

### ECONOS-031 — Vercel deployment `todo`
### ECONOS-032 — Production verification `todo`
### ECONOS-033 — Release v1.0.0 `todo`
