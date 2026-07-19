#!/usr/bin/env python3
"""
EconOS — processed-data validation gate.

Validates every committed snapshot in data/processed/ against the series
registry. Runs in CI and after every scheduled refresh; a violation fails the
build so bad data can never ship silently.

Checks per series:
  - snapshot exists for every registry entry, and no orphan snapshots exist
  - required fields present with correct types
  - metadata matches the registry (source, unit, frequency, identifiers)
  - observations: date-ordered, unique dates, numeric values, ISO dates
  - values within the registry's plausible range
  - date continuity appropriate to the declared frequency (gap detection)
  - latestObservation matches the final observation
  - recency: latest observation is not implausibly old for its frequency
    (warns rather than fails — a late release is a fact, not a bug)

Usage:
    python3 pipelines/validate/validate_processed.py
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO_ROOT / "data" / "metadata" / "series_registry.json"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"

REQUIRED_FIELDS = {
    "id": str, "sourceId": str, "source": str, "title": str, "unit": str,
    "frequency": str, "seasonalAdjustment": str, "geography": str,
    "transformation": str, "sourceUrl": str, "license": str, "limitations": str,
    "retrievedAt": str, "latestObservation": str, "stale": bool,
    "observations": list,
}

# Maximum plausible gap between consecutive observations, in days. Allows one
# skipped release period (e.g. the missed monthly releases around the late-2025
# federal shutdown) without failing; two consecutive missing periods still fail.
MAX_GAP_DAYS = {"D": 7, "W": 21, "M": 70, "Q": 200, "A": 800}

# How old the latest observation may be before we flag it as possibly stale.
# Calibrated to typical publication lags (JOLTS ~2 months, Case-Shiller ~3
# months, GDP quarterly with a one-quarter lag). Per-series override:
# registry field `recencyWarnDays`.
RECENCY_WARN_DAYS = {"D": 14, "W": 30, "M": 120, "Q": 230, "A": 800}


def check_series(entry: dict, errors: list[str], warnings: list[str]) -> None:
    series_id = entry["id"]
    path = PROCESSED_DIR / f"{series_id}.json"
    if not path.exists():
        errors.append(f"{series_id}: snapshot missing")
        return

    with open(path, encoding="utf-8") as f:
        snapshot = json.load(f)

    for field, expected_type in REQUIRED_FIELDS.items():
        if field not in snapshot:
            errors.append(f"{series_id}: missing field {field!r}")
            return
        if not isinstance(snapshot[field], expected_type):
            errors.append(f"{series_id}: field {field!r} has wrong type")
            return

    for field in ("sourceId", "source", "unit", "frequency"):
        registry_value = entry[field if field != "unit" else "unit"]
        if snapshot[field] != registry_value:
            errors.append(
                f"{series_id}: {field} mismatch (snapshot={snapshot[field]!r}, "
                f"registry={registry_value!r})"
            )

    observations = snapshot["observations"]
    if len(observations) < 8:
        errors.append(f"{series_id}: only {len(observations)} observations")
        return

    low, high = entry["plausibleRange"]
    previous_date: date | None = None
    max_gap = MAX_GAP_DAYS[entry["frequency"]]
    for pair in observations:
        if not (isinstance(pair, list) and len(pair) == 2):
            errors.append(f"{series_id}: malformed observation {pair!r}")
            return
        observation_date = date.fromisoformat(pair[0])
        value = pair[1]
        if not isinstance(value, (int, float)):
            errors.append(f"{series_id}: non-numeric value on {pair[0]}")
            return
        if not (low <= value <= high):
            errors.append(f"{series_id}: {value} on {pair[0]} outside [{low}, {high}]")
        if previous_date is not None:
            if observation_date <= previous_date:
                errors.append(f"{series_id}: dates not strictly increasing at {pair[0]}")
            elif (observation_date - previous_date).days > max_gap:
                errors.append(
                    f"{series_id}: gap of {(observation_date - previous_date).days} days "
                    f"before {pair[0]} exceeds {max_gap} for frequency {entry['frequency']}"
                )
        previous_date = observation_date

    if snapshot["latestObservation"] != observations[-1][0]:
        errors.append(f"{series_id}: latestObservation does not match final observation")

    age_days = (date.today() - date.fromisoformat(snapshot["latestObservation"])).days
    recency_limit = entry.get("recencyWarnDays", RECENCY_WARN_DAYS[entry["frequency"]])
    if age_days > recency_limit and not snapshot["stale"]:
        warnings.append(
            f"{series_id}: latest observation {snapshot['latestObservation']} is "
            f"{age_days} days old but snapshot is not marked stale"
        )


def check_catalog(registry: dict, errors: list[str]) -> None:
    catalog_path = PROCESSED_DIR / "catalog.json"
    if not catalog_path.exists():
        errors.append("catalog.json missing")
        return
    with open(catalog_path, encoding="utf-8") as f:
        catalog = json.load(f)
    registry_ids = {entry["id"] for entry in registry["series"]}
    catalog_ids = {entry["id"] for entry in catalog["series"]}
    if registry_ids != catalog_ids:
        errors.append(
            f"catalog/registry mismatch: missing={registry_ids - catalog_ids}, "
            f"orphaned={catalog_ids - registry_ids}"
        )


def main() -> int:
    with open(REGISTRY_PATH, encoding="utf-8") as f:
        registry = json.load(f)

    errors: list[str] = []
    warnings: list[str] = []

    registry_files = {f"{entry['id']}.json" for entry in registry["series"]}
    for snapshot_file in PROCESSED_DIR.glob("*.json"):
        if snapshot_file.name != "catalog.json" and snapshot_file.name not in registry_files:
            errors.append(f"orphan snapshot not in registry: {snapshot_file.name}")

    for entry in registry["series"]:
        check_series(entry, errors, warnings)
    check_catalog(registry, errors)

    for warning in warnings:
        print(f"warn  {warning}")
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        print(f"\nValidation failed: {len(errors)} error(s).", file=sys.stderr)
        return 1

    print(f"Validation passed: {len(registry['series'])} series, {len(warnings)} warning(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
