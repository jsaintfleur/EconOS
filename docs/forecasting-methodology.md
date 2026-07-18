# EconOS — Forecasting Methodology

Last updated: 2026-07-18

## Philosophy

Forecasts in EconOS exist to demonstrate disciplined forecasting practice, not
to claim predictive superiority. Every forecast ships with its baseline
comparison, backtest errors, prediction intervals, and a plain statement that
forecasts are estimates, not guarantees. A complicated model is used only when
rolling-origin backtesting shows it beats the baseline.

## Targets (v1.0)

| Target | Series | Frequency | Horizon |
| --- | --- | --- | --- |
| CPI inflation (YoY) | CPIAUCSL → yoy | Monthly | 12 months |
| Unemployment rate | UNRATE | Monthly | 12 months |
| Payroll growth (MoM, thousands) | PAYEMS → diff | Monthly | 12 months |

## Model families evaluated

- **Naïve / seasonal naïve** — last value (or same month last year) carried
  forward. The baseline every other model must beat.
- **Drift** — random walk with average historical drift.
- **AR(p)** — autoregression on the transformed target, order chosen by AIC
  within a small grid.
- **SARIMA** — seasonal ARIMA where seasonality is plausible (inflation),
  order-restricted grid, AIC-selected.

Machine-learning and deep-learning models are excluded from v1.0: with a few
hundred monthly observations per target, backtesting cannot reliably
distinguish them from classical models, and their complexity is not justified
by the evidence. This is a documented decision, not an omission.

## Evaluation protocol

**Rolling-origin backtesting.** For each of the last `K = 60` months, models are
fit on data up to that origin and asked to forecast `h = 1, 3, 6, 12` months
ahead. Errors are aggregated per horizon.

Metrics:

- **MAE** — mean absolute error (primary; robust and in the target's units).
- **RMSE** — root mean squared error (penalizes large misses).
- **Mean directional accuracy** — share of correctly predicted direction
  changes, reported where direction is decision-relevant.
- **Interval coverage** — share of actuals falling inside the nominal 80%
  interval; reported so users can judge calibration.

MAPE is not used for these targets: unemployment and inflation pass near zero
historically, making percentage errors unstable.

**Model selection.** The published "selected model" per target is the one with
the lowest average MAE across horizons that is also no worse than the baseline
at every horizon; ties go to the simpler model.

## Prediction intervals

Intervals are computed from the empirical distribution of backtest errors per
horizon (quantiles of residuals), not from in-sample standard errors. This
makes coverage claims testable against the backtest itself.

## Artifacts

`models/run_forecasts.py` writes one JSON artifact per target to
`data/processed/forecasts/`, containing: model version, training window, run
date, per-horizon point forecasts and 50%/80% intervals, full backtest table
(all models × horizons × metrics), and the selection rationale. The Forecast
Center renders these artifacts verbatim — the UI cannot invent numbers the
pipeline did not produce.

## Known limitations

- Current-vintage data: backtests use today's revised data, which overstates
  the accuracy achievable in real time (especially for payrolls).
- Structural breaks: the pandemic period is inside the training history;
  error metrics include those regime shifts and are reported without exclusion.
- No exogenous drivers in v1.0: models are univariate; dynamic regression with
  leading indicators is a roadmap item.
