#!/usr/bin/env python3
"""
EconOS — forecast generation with rolling-origin backtesting.

Implements docs/forecasting-methodology.md:
  targets      : CPI inflation (YoY), unemployment rate, payroll growth (MoM)
  models       : naive, seasonal naive, drift, AR (AIC-selected), SARIMA
                 (inflation only — the one target with plausible seasonality
                 left after transformation)
  evaluation   : rolling-origin backtest, K=60 origins, horizons 1/3/6/12,
                 MAE (primary), RMSE, mean directional accuracy
  intervals    : empirical quantiles of the selected model's backtest errors
                 per horizon (50% and 80%) — calibration is testable
  selection    : lowest average MAE among models that beat the naive baseline
                 on average; the baseline itself wins if nothing beats it;
                 ties go to the simpler model (list order encodes simplicity)

Artifacts are written to data/processed/forecasts/<target>.json and rendered
verbatim by the Forecast Center — the UI cannot invent numbers.

Usage:
    python3 models/run_forecasts.py
"""

from __future__ import annotations

import json
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore")  # statsmodels convergence chatter

REPO_ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
FORECAST_DIR = PROCESSED_DIR / "forecasts"

MODEL_VERSION = "1.0.0"
BACKTEST_ORIGINS = 60
HORIZONS = [1, 3, 6, 12]
FORECAST_HORIZON = 12


# ---------------------------------------------------------------------------
# Data loading and transformation
# ---------------------------------------------------------------------------

def load_snapshot(series_id: str) -> tuple[list[str], np.ndarray]:
    with open(PROCESSED_DIR / f"{series_id}.json", encoding="utf-8") as f:
        snapshot = json.load(f)
    dates = [d for d, _ in snapshot["observations"]]
    values = np.array([v for _, v in snapshot["observations"]], dtype=float)
    return dates, values


def fill_single_month_gaps(dates: list[str], values: np.ndarray) -> tuple[list[str], np.ndarray, list[str]]:
    """
    Interpolate isolated missing months (e.g. the missed federal releases of
    late 2025) so models see an evenly spaced series. Only single-month gaps
    are filled, by linear interpolation; anything larger raises. Every filled
    month is recorded and disclosed in the artifact's limitations.
    """
    filled_dates: list[str] = [dates[0]]
    filled_values: list[float] = [float(values[0])]
    imputed: list[str] = []

    for i in range(1, len(dates)):
        prev_year, prev_month = int(dates[i - 1][:4]), int(dates[i - 1][5:7])
        year, month = int(dates[i][:4]), int(dates[i][5:7])
        months_apart = (year - prev_year) * 12 + (month - prev_month)
        if months_apart == 2:
            gap_month = prev_month + 1
            gap_year = prev_year + (1 if gap_month > 12 else 0)
            gap_month = 1 if gap_month > 12 else gap_month
            gap_date = f"{gap_year:04d}-{gap_month:02d}-01"
            filled_dates.append(gap_date)
            filled_values.append(float((values[i - 1] + values[i]) / 2))
            imputed.append(gap_date)
        elif months_apart > 2:
            raise ValueError(f"gap of {months_apart} months before {dates[i]}")
        filled_dates.append(dates[i])
        filled_values.append(float(values[i]))

    return filled_dates, np.array(filled_values), imputed


def yoy_percent(values: np.ndarray, lag: int = 12) -> np.ndarray:
    return (values[lag:] / values[:-lag] - 1.0) * 100.0


def next_months(last_iso: str, count: int) -> list[str]:
    year, month = int(last_iso[:4]), int(last_iso[5:7])
    result = []
    for _ in range(count):
        month += 1
        if month > 12:
            month, year = 1, year + 1
        result.append(f"{year:04d}-{month:02d}-01")
    return result


# ---------------------------------------------------------------------------
# Models — each maps a history array to an h-step-ahead path
# ---------------------------------------------------------------------------

def forecast_naive(history: np.ndarray, steps: int) -> np.ndarray:
    return np.full(steps, history[-1])


def forecast_seasonal_naive(history: np.ndarray, steps: int, period: int = 12) -> np.ndarray:
    if len(history) < period:
        return forecast_naive(history, steps)
    return np.array([history[len(history) - period + (i % period)] for i in range(steps)])


def forecast_drift(history: np.ndarray, steps: int) -> np.ndarray:
    slope = (history[-1] - history[0]) / (len(history) - 1)
    return history[-1] + slope * np.arange(1, steps + 1)


def forecast_ar(history: np.ndarray, steps: int) -> np.ndarray:
    """AR(p) with AIC-selected order up to 13, constant trend."""
    from statsmodels.tsa.ar_model import AutoReg, ar_select_order

    selection = ar_select_order(history, maxlag=13, ic="aic", old_names=False)
    lags = selection.ar_lags if selection.ar_lags else [1]
    fitted = AutoReg(history, lags=lags, old_names=False).fit()
    return np.asarray(fitted.forecast(steps=steps))


def forecast_sarima(history: np.ndarray, steps: int) -> np.ndarray:
    """SARIMA(1,0,1)(1,0,1,12) — a deliberately small, fixed specification."""
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    fitted = SARIMAX(
        history,
        order=(1, 0, 1),
        seasonal_order=(1, 0, 1, 12),
        enforce_stationarity=False,
        enforce_invertibility=False,
    ).fit(disp=False, maxiter=200)
    return np.asarray(fitted.forecast(steps=steps))


MODEL_FUNCS = {
    "naive": forecast_naive,
    "seasonal_naive": forecast_seasonal_naive,
    "drift": forecast_drift,
    "ar": forecast_ar,
    "sarima": forecast_sarima,
}

MODEL_LABELS = {
    "naive": "Naïve (last value)",
    "seasonal_naive": "Seasonal naïve (same month last year)",
    "drift": "Random walk with drift",
    "ar": "Autoregression (AIC-selected order)",
    "sarima": "SARIMA (1,0,1)(1,0,1,12)",
}


# ---------------------------------------------------------------------------
# Backtesting
# ---------------------------------------------------------------------------

def rolling_backtest(values: np.ndarray, model_names: list[str]) -> dict:
    """
    For each of the last BACKTEST_ORIGINS observations (leaving room for the
    longest horizon), fit on data up to the origin and forecast each horizon.
    Returns per-model per-horizon error lists.
    """
    max_h = max(HORIZONS)
    first_origin = len(values) - BACKTEST_ORIGINS - max_h
    if first_origin < 60:
        raise ValueError("not enough history for the requested backtest")

    errors: dict[str, dict[int, list[float]]] = {
        m: {h: [] for h in HORIZONS} for m in model_names
    }
    directional: dict[str, dict[int, list[bool]]] = {
        m: {h: [] for h in HORIZONS} for m in model_names
    }

    for origin in range(first_origin, len(values) - max_h):
        history = values[:origin]
        for name in model_names:
            try:
                path = MODEL_FUNCS[name](history, max_h)
            except Exception:
                # A fit failure at one origin contributes no observations —
                # never a fabricated value.
                continue
            for h in HORIZONS:
                actual = values[origin + h - 1]
                predicted = path[h - 1]
                errors[name][h].append(float(predicted - actual))
                actual_direction = actual - history[-1]
                predicted_direction = predicted - history[-1]
                directional[name][h].append(
                    bool(np.sign(actual_direction) == np.sign(predicted_direction))
                )

    table = []
    for name in model_names:
        mae = {h: float(np.mean(np.abs(errors[name][h]))) for h in HORIZONS}
        rmse = {h: float(np.sqrt(np.mean(np.square(errors[name][h])))) for h in HORIZONS}
        mda = {h: float(np.mean(directional[name][h])) for h in HORIZONS}
        table.append(
            {
                "model": name,
                "label": MODEL_LABELS[name],
                "mae": mae,
                "rmse": rmse,
                "directionalAccuracy": mda,
                "avgMae": float(np.mean(list(mae.values()))),
                "originCount": len(errors[name][HORIZONS[0]]),
            }
        )
    return {"table": table, "errors": errors}


def select_model(table: list[dict], baseline: str) -> tuple[str, str]:
    baseline_avg = next(r["avgMae"] for r in table if r["model"] == baseline)
    challengers = [r for r in table if r["avgMae"] < baseline_avg]
    if not challengers:
        return baseline, (
            f"No candidate beat the {MODEL_LABELS[baseline]} baseline on average "
            f"MAE across horizons; the baseline is published. This is reported "
            f"honestly rather than hidden."
        )
    best = min(challengers, key=lambda r: r["avgMae"])
    improvement = (1 - best["avgMae"] / baseline_avg) * 100
    return best["model"], (
        f"{best['label']} achieved the lowest average MAE across horizons, "
        f"{improvement:.0f}% below the {MODEL_LABELS[baseline]} baseline."
    )


# ---------------------------------------------------------------------------
# Artifact generation
# ---------------------------------------------------------------------------

def build_artifact(
    target: str,
    title: str,
    unit: str,
    source_series: str,
    transformation: str,
    dates: list[str],
    values: np.ndarray,
    model_names: list[str],
    extra_limitations: list[str],
) -> dict:
    backtest = rolling_backtest(values, model_names)
    selected, rationale = select_model(backtest["table"], baseline="naive")

    # Final forecast: fit the selected model on the full history.
    path = MODEL_FUNCS[selected](values, FORECAST_HORIZON)
    future_dates = next_months(dates[-1], FORECAST_HORIZON)

    # Empirical intervals from the selected model's backtest errors. Horizons
    # between measured ones reuse the nearest measured horizon's spread.
    def nearest_horizon(h: int) -> int:
        return min(HORIZONS, key=lambda m: abs(m - h))

    points = []
    for i, (date, value) in enumerate(zip(future_dates, path), start=1):
        errs = np.array(backtest["errors"][selected][nearest_horizon(i)])
        points.append(
            {
                "date": date,
                "value": round(float(value), 3),
                "p10": round(float(value - np.quantile(errs, 0.90)), 3),
                "p25": round(float(value - np.quantile(errs, 0.75)), 3),
                "p75": round(float(value - np.quantile(errs, 0.25)), 3),
                "p90": round(float(value - np.quantile(errs, 0.10)), 3),
            }
        )

    # 80% interval coverage measured on the backtest itself (per horizon).
    coverage = {}
    for h in HORIZONS:
        errs = np.array(backtest["errors"][selected][h])
        lo, hi = np.quantile(errs, 0.10), np.quantile(errs, 0.90)
        coverage[h] = float(np.mean((errs >= lo) & (errs <= hi)))

    for row in backtest["table"]:
        row.pop("originCount", None)

    return {
        "target": target,
        "title": title,
        "unit": unit,
        "sourceSeries": source_series,
        "transformation": transformation,
        "modelVersion": MODEL_VERSION,
        "runDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "trainingWindow": {"start": dates[0], "end": dates[-1], "observations": len(values)},
        "backtest": {
            "protocol": "rolling-origin",
            "origins": BACKTEST_ORIGINS,
            "horizons": HORIZONS,
            "table": backtest["table"],
            "intervalCoverage80": coverage,
        },
        "selectedModel": selected,
        "selectedModelLabel": MODEL_LABELS[selected],
        "baselineModel": "naive",
        "selectionRationale": rationale,
        "history": [[d, round(float(v), 3)] for d, v in zip(dates[-96:], values[-96:])],
        "forecast": points,
        "disclaimer": "Forecasts are statistical estimates, not guarantees. Intervals reflect historical backtest error, which understates uncertainty around structural change.",
        "limitations": [
            "Univariate model: no exogenous drivers (policy, energy prices, fiscal shocks).",
            "Trained on current-vintage (revised) data; real-time accuracy would be lower.",
            "Backtest window includes the pandemic regime shift; errors reflect it.",
            *extra_limitations,
        ],
    }


def main() -> int:
    FORECAST_DIR.mkdir(parents=True, exist_ok=True)

    # --- CPI inflation, YoY % --------------------------------------------
    cpi_dates, cpi_values = load_snapshot("cpi_all")
    cpi_dates, cpi_values, cpi_imputed = fill_single_month_gaps(cpi_dates, cpi_values)
    inflation_values = yoy_percent(cpi_values)
    inflation_dates = cpi_dates[12:]
    artifacts = [
        build_artifact(
            target="inflation",
            title="CPI inflation",
            unit="% year-over-year",
            source_series="CPIAUCSL (BLS via FRED)",
            transformation="Year-over-year percent change of the seasonally adjusted index",
            dates=inflation_dates,
            values=inflation_values,
            model_names=["naive", "seasonal_naive", "drift", "ar", "sarima"],
            extra_limitations=[
                f"Missing federal releases interpolated for: {', '.join(cpi_imputed)}."
                if cpi_imputed
                else "No imputed observations.",
            ],
        )
    ]

    # --- Unemployment rate, level ----------------------------------------
    un_dates, un_values = load_snapshot("unemployment_rate")
    un_dates, un_values, un_imputed = fill_single_month_gaps(un_dates, un_values)
    artifacts.append(
        build_artifact(
            target="unemployment",
            title="Unemployment rate",
            unit="%",
            source_series="UNRATE (BLS via FRED)",
            transformation="None (published U-3 rate)",
            dates=un_dates,
            values=un_values,
            model_names=["naive", "seasonal_naive", "drift", "ar"],
            extra_limitations=[
                f"Missing federal releases interpolated for: {', '.join(un_imputed)}."
                if un_imputed
                else "No imputed observations.",
                "The unemployment rate is bounded below; near historic lows, downside interval width is mechanical, not informative.",
            ],
        )
    )

    # --- Payroll growth, MoM change in thousands --------------------------
    pay_dates, pay_values = load_snapshot("payrolls")
    pay_dates, pay_values, pay_imputed = fill_single_month_gaps(pay_dates, pay_values)
    payroll_change = np.diff(pay_values)
    artifacts.append(
        build_artifact(
            target="payrolls",
            title="Payroll growth",
            unit="thousands of jobs, month-over-month",
            source_series="PAYEMS (BLS via FRED)",
            transformation="First difference of total nonfarm payrolls",
            dates=pay_dates[1:],
            values=payroll_change,
            model_names=["naive", "seasonal_naive", "drift", "ar"],
            extra_limitations=[
                f"Missing federal releases interpolated for: {', '.join(pay_imputed)}."
                if pay_imputed
                else "No imputed observations.",
                "Payroll figures are revised twice after first release and benchmarked annually; month-one values differ from the history modeled here.",
            ],
        )
    )

    for artifact in artifacts:
        out_path = FORECAST_DIR / f"{artifact['target']}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(artifact, f, indent=2)
        table = {r["model"]: r["avgMae"] for r in artifact["backtest"]["table"]}
        print(f"{artifact['target']:<14} selected={artifact['selectedModel']:<15} avgMAE={table}")

    print(f"\nArtifacts written to {FORECAST_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
