#!/usr/bin/env python3
"""
EconOS — FRED snapshot ingestion.

Reads data/metadata/series_registry.json and refreshes one processed JSON
snapshot per series in data/processed/, using FRED's public fredgraph.csv
endpoint (no API key required).

Failure policy (see docs/architecture.md):
  - A series that fails to download or validate keeps its last committed
    snapshot on disk, which is re-marked `stale: true`.
  - The catalog is rebuilt from whatever snapshots exist, so a partial refresh
    can never publish fabricated or truncated data as fresh.
  - The script exits non-zero if any series failed, so CI and the scheduled
    refresh workflow surface the problem.

Usage:
    python3 pipelines/ingest/fetch_fred.py            # refresh everything
    python3 pipelines/ingest/fetch_fred.py UNRATE ... # refresh specific sourceIds
"""

from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO_ROOT / "data" / "metadata" / "series_registry.json"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"

FREDGRAPH_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={source_id}"
USER_AGENT = "EconOS/1.0 (economic research; github.com/jsaintfleur/EconOS)"
TIMEOUT_SECONDS = 60


def load_registry() -> dict:
    with open(REGISTRY_PATH, encoding="utf-8") as f:
        return json.load(f)


def fetch_csv(source_id: str) -> str:
    request = urllib.request.Request(
        FREDGRAPH_URL.format(source_id=source_id),
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return response.read().decode("utf-8")


def parse_observations(csv_text: str, source_id: str) -> list[tuple[str, float]]:
    """Parse fredgraph CSV into [(iso_date, value)] and drop missing markers."""
    reader = csv.reader(io.StringIO(csv_text))
    header = next(reader)
    if len(header) != 2 or header[0] != "observation_date":
        raise ValueError(f"{source_id}: unexpected CSV header {header!r}")

    observations: list[tuple[str, float]] = []
    for row in reader:
        if len(row) != 2:
            raise ValueError(f"{source_id}: malformed row {row!r}")
        observation_date, raw_value = row
        # FRED uses "." for missing observations (e.g. market holidays).
        if raw_value.strip() in {".", ""}:
            continue
        # Validates ISO format; raises on anything unexpected.
        date.fromisoformat(observation_date)
        observations.append((observation_date, float(raw_value)))
    return observations


def validate_observations(entry: dict, observations: list[tuple[str, float]]) -> None:
    """Gate a freshly fetched series before it can replace the prior snapshot."""
    source_id = entry["sourceId"]
    if len(observations) < 8:
        raise ValueError(f"{source_id}: only {len(observations)} observations")

    dates = [d for d, _ in observations]
    if dates != sorted(dates):
        raise ValueError(f"{source_id}: observations not date-ordered")
    if len(set(dates)) != len(dates):
        raise ValueError(f"{source_id}: duplicate observation dates")

    low, high = entry["plausibleRange"]
    for observation_date, value in observations:
        if not (low <= value <= high):
            raise ValueError(
                f"{source_id}: value {value} on {observation_date} outside "
                f"plausible range [{low}, {high}]"
            )


def build_snapshot(entry: dict, observations: list[tuple[str, float]]) -> dict:
    trim_start = entry.get("trimStart")
    if trim_start:
        observations = [(d, v) for d, v in observations if d >= trim_start]

    return {
        "id": entry["id"],
        "sourceId": entry["sourceId"],
        "source": entry["source"],
        "title": entry["displayName"],
        "unit": entry["unit"],
        "frequency": entry["frequency"],
        "seasonalAdjustment": entry["seasonalAdjustment"],
        "geography": entry["geography"],
        "transformation": entry["transformation"],
        "sourceUrl": entry["sourceUrl"],
        "license": entry["license"],
        "limitations": entry["limitations"],
        "retrievedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "latestObservation": observations[-1][0],
        "stale": False,
        "observations": observations,
    }


def mark_stale(snapshot_path: Path) -> None:
    """Re-mark an existing snapshot stale after a failed refresh."""
    if not snapshot_path.exists():
        return
    with open(snapshot_path, encoding="utf-8") as f:
        snapshot = json.load(f)
    snapshot["stale"] = True
    with open(snapshot_path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, separators=(",", ":"))


def write_catalog(registry: dict) -> None:
    """Aggregate registry metadata + snapshot status into catalog.json."""
    catalog = {"generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "series": []}
    for entry in registry["series"]:
        snapshot_path = PROCESSED_DIR / f"{entry['id']}.json"
        status: dict = {**entry}
        if snapshot_path.exists():
            with open(snapshot_path, encoding="utf-8") as f:
                snapshot = json.load(f)
            status.update(
                available=True,
                stale=snapshot["stale"],
                retrievedAt=snapshot["retrievedAt"],
                latestObservation=snapshot["latestObservation"],
                observationCount=len(snapshot["observations"]),
                firstObservation=snapshot["observations"][0][0],
            )
        else:
            status.update(available=False, stale=True)
        catalog["series"].append(status)

    with open(PROCESSED_DIR / "catalog.json", "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)


def main() -> int:
    registry = load_registry()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    only_ids = set(sys.argv[1:])
    failures: list[str] = []

    for entry in registry["series"]:
        if only_ids and entry["sourceId"] not in only_ids:
            continue
        snapshot_path = PROCESSED_DIR / f"{entry['id']}.json"
        try:
            csv_text = fetch_csv(entry["sourceId"])
            observations = parse_observations(csv_text, entry["sourceId"])
            validate_observations(entry, observations)
            snapshot = build_snapshot(entry, observations)
            with open(snapshot_path, "w", encoding="utf-8") as f:
                json.dump(snapshot, f, separators=(",", ":"))
            print(f"ok    {entry['sourceId']:<16} {entry['id']:<28} "
                  f"latest={snapshot['latestObservation']} n={len(snapshot['observations'])}")
        except Exception as error:  # noqa: BLE001 — any failure means stale, never fabricate
            failures.append(entry["sourceId"])
            mark_stale(snapshot_path)
            print(f"FAIL  {entry['sourceId']:<16} {entry['id']:<28} {error}", file=sys.stderr)

    write_catalog(registry)

    if failures:
        print(f"\n{len(failures)} series failed: {', '.join(failures)}", file=sys.stderr)
        return 1
    print(f"\nAll series refreshed. Catalog written to {PROCESSED_DIR / 'catalog.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
