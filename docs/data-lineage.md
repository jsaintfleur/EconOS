# EconOS — Data Lineage

Last updated: 2026-07-18

## Lineage model

Every number rendered in the application traces through four auditable steps,
all versioned in this repository:

```
1. Registry entry      data/metadata/series_registry.json   (what & from where)
2. Ingestion run       pipelines/ingest/fetch_fred.py       (how retrieved)
3. Validated snapshot  data/processed/<id>.json             (what we hold)
4. Documented formula  apps/web/src/lib/econ.ts             (how transformed)
```

Because snapshots are committed, `git log -- data/processed/` is a complete
retrieval history: what changed, when, and under which pipeline version.
Scheduled refreshes arrive as pull requests (`.github/workflows/
data-refresh.yml`), so every data change has a reviewable diff.

## Guarantees

- **No untracked inputs.** The app can only read `data/processed/`; there is
  no runtime fetching and no side-channel data.
- **No fabrication.** A failed retrieval preserves the previous snapshot and
  marks it `stale: true`; the UI surfaces the badge. Validation
  (`pipelines/validate/validate_processed.py`) blocks contract-breaking data
  in CI.
- **Vintage transparency.** Snapshots carry `retrievedAt` and
  `latestObservation`; the UI always shows observation dates. Data are
  current-vintage (revised) series — real-time vintages are out of scope for
  v1.0 and stated as a limitation wherever accuracy claims are made.
- **Imputation disclosure.** The forecasting pipeline interpolates isolated
  single-month release gaps (late-2025 missed federal releases) for model
  continuity only; every imputed month is listed in the artifact's
  limitations. Display pages show the published data with the gap intact.

## Forecast lineage

`models/run_forecasts.py` reads only validated snapshots and writes
`data/processed/forecasts/<target>.json` containing the model version,
training window, run date, full backtest table, and selection rationale. The
Forecast Center renders artifacts verbatim — a forecast number that isn't in
a committed artifact cannot appear in the UI.
