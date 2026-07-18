import { z } from "zod";

/**
 * Data contract for processed series snapshots.
 *
 * Snapshots are produced by pipelines/ingest/fetch_fred.py and committed to
 * data/processed/. The app validates every snapshot against this schema at
 * module load, so a malformed snapshot fails the build instead of rendering
 * wrong numbers. Keep in sync with docs/architecture.md ("Data contracts").
 */

/** A single observation: [ISO date, value]. */
export const observationSchema = z.tuple([z.string(), z.number()]);
export type Observation = z.infer<typeof observationSchema>;

export const frequencySchema = z.enum(["D", "W", "M", "Q", "A"]);
export type Frequency = z.infer<typeof frequencySchema>;

export const seriesSnapshotSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  source: z.string(),
  title: z.string(),
  unit: z.string(),
  frequency: frequencySchema,
  seasonalAdjustment: z.string(),
  geography: z.string(),
  transformation: z.string(),
  sourceUrl: z.string().url(),
  license: z.string(),
  limitations: z.string(),
  /** ISO date the ingestion pipeline ran. */
  retrievedAt: z.string(),
  /** ISO date of the newest observation — what the data actually covers. */
  latestObservation: z.string(),
  /** Set true by the pipeline when a refresh failed; the UI must surface it. */
  stale: z.boolean(),
  observations: z.array(observationSchema).min(8),
});

export type SeriesSnapshot = z.infer<typeof seriesSnapshotSchema>;

/** Catalog entry: registry metadata + snapshot status (drives /data). */
export const catalogEntrySchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  displayName: z.string(),
  source: z.string(),
  sourceUrl: z.string().url(),
  frequency: frequencySchema,
  unit: z.string(),
  seasonalAdjustment: z.string(),
  geography: z.string(),
  transformation: z.string(),
  license: z.string(),
  limitations: z.string(),
  available: z.boolean(),
  stale: z.boolean(),
  retrievedAt: z.string().optional(),
  latestObservation: z.string().optional(),
  observationCount: z.number().optional(),
  firstObservation: z.string().optional(),
});

export const catalogSchema = z.object({
  generatedAt: z.string(),
  series: z.array(catalogEntrySchema),
});

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;
export type Catalog = z.infer<typeof catalogSchema>;
