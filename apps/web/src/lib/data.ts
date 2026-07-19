import fs from "node:fs";
import path from "node:path";
import {
  type Catalog,
  type SeriesSnapshot,
  catalogSchema,
  seriesSnapshotSchema,
} from "./types";

/**
 * Build-time data access for processed snapshots.
 *
 * All pages in EconOS are statically generated (see `force-static` in the
 * root layout), so these readers only ever run during `next build` — the
 * deployed application serves prebuilt HTML and never touches the filesystem
 * at request time. Snapshots are zod-validated on first read: a malformed or
 * contract-breaking snapshot fails the build rather than shipping bad data.
 */

/** Walk upward from the app directory to locate the monorepo data folder. */
function findDataDir(): string {
  let current = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(current, "data", "processed");
    if (fs.existsSync(candidate)) return candidate;
    current = path.dirname(current);
  }
  throw new Error(
    "data/processed not found — run pipelines/ingest/fetch_fred.py first",
  );
}

const dataDir = findDataDir();

/** Snapshot cache so repeated loads during a build parse each file once. */
const snapshotCache = new Map<string, SeriesSnapshot>();

/** Load and validate one processed series snapshot by internal id. */
export function getSeries(id: string): SeriesSnapshot {
  const cached = snapshotCache.get(id);
  if (cached) return cached;

  const filePath = path.join(dataDir, `${id}.json`);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const snapshot = seriesSnapshotSchema.parse(raw);
  snapshotCache.set(id, snapshot);
  return snapshot;
}

/** Load several series at once, preserving order. */
export function getManySeries(ids: string[]): SeriesSnapshot[] {
  return ids.map(getSeries);
}

let catalogCache: Catalog | null = null;

/** Load the full data catalog (registry metadata + snapshot status). */
export function getCatalog(): Catalog {
  if (catalogCache) return catalogCache;
  const raw = JSON.parse(
    fs.readFileSync(path.join(dataDir, "catalog.json"), "utf-8"),
  );
  catalogCache = catalogSchema.parse(raw);
  return catalogCache;
}

/**
 * Load a forecast artifact produced by models/run_forecasts.py.
 * Returns the parsed JSON, or null when the artifact has not been generated —
 * callers must render an explicit empty state, never placeholder numbers.
 */
export function getForecastArtifact(target: string): unknown | null {
  const filePath = path.join(dataDir, "forecasts", `${target}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
