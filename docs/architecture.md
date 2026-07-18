# EconOS — Technical Architecture

Last updated: 2026-07-18

## Overview

EconOS is a statically generated Next.js application fed by reproducible Python
data pipelines. There is no runtime database and no server-side data fetching in
the request path: authoritative sources are ingested on a schedule, validated,
committed as compact processed JSON snapshots with full metadata, and compiled
into the application at build time.

```
┌─────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│ Authoritative       │     │ Python pipelines      │     │ data/processed/      │
│ public sources      │ ──▶ │ ingest → validate →   │ ──▶ │ JSON snapshots +     │
│ (FRED, BLS, BEA,    │     │ publish               │     │ catalog metadata     │
│  Census, Freddie)   │     └──────────────────────┘     └──────────┬───────────┘
└─────────────────────┘                                             │ build time
                                                          ┌─────────▼───────────┐
                                                          │ apps/web (Next.js)   │
                                                          │ static generation →  │
                                                          │ Vercel               │
                                                          └─────────────────────┘
```

## Why this architecture

- **Reproducibility.** Every number on the site traces to a committed snapshot
  produced by a committed script from a registered source. `git log` is the data
  lineage.
- **Honest freshness.** Each snapshot records both the latest observation date
  (what the data says) and the retrieval date (when we fetched it). The UI
  displays observation dates; staleness is computed, not asserted.
- **No key management.** v1.0 ingestion uses FRED's public `fredgraph.csv`
  endpoint, which requires no API key. Optional keys (`.env.example`) raise rate
  limits or unlock richer APIs later; none are required to build or deploy.
- **Failure isolation.** If a source fails during refresh, the last validated
  snapshot is preserved and marked stale. A partial refresh can never corrupt
  the published dataset or fabricate values.
- **Cost and speed.** Static pages on Vercel are fast, cacheable, and free of
  runtime data dependencies. Macroeconomic data updates monthly/weekly — there
  is no case for per-request fetching.

## Repository layout

```
apps/web/                  Next.js 15 App Router, strict TypeScript, Tailwind v4
  src/app/                 Routes: /, /overview, /inflation, /labor, /housing,
                           /research/*, /forecasts, /simulator, /data, /about
  src/components/          Design system (charts, metric cards, layout, nav)
  src/lib/                 Data loading, economic calculations, formatting
  src/data/                Symlink-free re-export of ../../data/processed via lib
pipelines/
  ingest/fetch_fred.py     Keyless FRED snapshot ingestion (registry-driven)
  validate/validate_processed.py  Schema/continuity/range validation (CI gate)
models/                    Forecast generation + rolling-origin backtesting
data/
  metadata/series_registry.json   Source of truth for every series
  processed/               Committed JSON snapshots + catalog.json + forecasts/
docs/                      Product, methodology, architecture documentation
.github/workflows/         ci.yml (quality gates), data-refresh.yml (scheduled)
```

## Frontend

- **Next.js (App Router), React, strict TypeScript.** All data pages are
  statically generated; snapshot JSON is imported at build time through typed
  loaders in `src/lib/data.ts`.
- **Tailwind CSS** with a custom design-token layer (see
  `docs/design-system.md`): premium neutral palette, restrained accent color,
  strong typographic hierarchy, light and dark modes.
- **Recharts** for time-series and scatter charts, wrapped in an in-house
  `TimeSeriesChart` component that enforces the chart contract: title, subtitle,
  units, period, source, last-update date, accessible description, tooltips.
- **Zod** at the data boundary: snapshots are parsed and validated when loaded,
  so a malformed snapshot fails the build rather than rendering wrong numbers.

## Data contracts

Every processed snapshot conforms to:

```ts
interface SeriesSnapshot {
  id: string;              // internal series name (e.g. "unemployment_rate")
  sourceId: string;        // original identifier (e.g. FRED "UNRATE")
  source: string;          // originating organization
  title: string; unit: string; frequency: "D" | "W" | "M" | "Q";
  seasonalAdjustment: string; geography: string;
  transformation: string;  // e.g. "none", "yoy_pct_change"
  retrievedAt: string;     // ISO date the pipeline ran
  latestObservation: string; // ISO date of newest data point
  stale: boolean;          // set by pipeline on refresh failure
  observations: [string, number][]; // [ISO date, value]
}
```

`catalog.json` aggregates the registry entry + snapshot status for every series
and drives the Data & Methods page.

## Forecasting (models/)

Python (statsmodels) jobs read processed snapshots, run rolling-origin backtests
comparing a seasonal-naïve baseline against classical models (drift, AR,
SARIMA), and publish forecast artifacts (point forecasts, prediction intervals,
backtest error tables, model version, training window) as JSON consumed by the
Forecast Center. Models are chosen by validated error, not sophistication; see
`docs/forecasting-methodology.md`.

## Testing

- **Vitest** — economic calculation library (growth rates, real values,
  mortgage amortization, index math) and component tests.
- **Python validation** — snapshot schema, date continuity, allowed ranges,
  duplicate detection; runs in CI and after every refresh.
- **Playwright smoke tests** — route rendering and navigation (added in
  hardening phase).

## Deployment

Vercel, building `apps/web` from `main` for production with preview deployments
on pull requests. Scheduled GitHub Actions refresh data and open an automated
PR with updated snapshots, so every data change is reviewed, versioned, and
attributable.

## Decisions log

| Decision | Alternatives | Rationale |
| --- | --- | --- |
| Committed JSON snapshots | Runtime API calls; database | Reproducibility, zero secrets, honest lineage, static speed |
| Keyless `fredgraph.csv` | FRED API (key) | No credential management for contributors/CI; identical data |
| Recharts | ECharts, D3 | Sufficient for chart contract, small API surface, SSR-friendly |
| No database in v1.0 | Neon/Supabase | Nothing to persist yet (per ticket: only add when required) |
| Single-app monorepo (packages/ deferred) | Full packages/ split | One consumer today; premature extraction adds friction without benefit — revisit when a second app exists |
