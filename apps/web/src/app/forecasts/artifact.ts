import { z } from "zod";
import { getForecastArtifact } from "@/lib/data";

/**
 * Forecast artifact contract — mirrors the JSON emitted by
 * models/run_forecasts.py. Parsed with zod so a malformed artifact fails the
 * build instead of rendering a wrong forecast.
 */

const metricByHorizonSchema = z.record(z.string(), z.number());

export const backtestRowSchema = z.object({
  model: z.string(),
  label: z.string(),
  mae: metricByHorizonSchema,
  rmse: metricByHorizonSchema,
  directionalAccuracy: metricByHorizonSchema,
  avgMae: z.number(),
});

export const forecastPointSchema = z.object({
  date: z.string(),
  value: z.number(),
  p10: z.number(),
  p25: z.number(),
  p75: z.number(),
  p90: z.number(),
});

export const forecastArtifactSchema = z.object({
  target: z.string(),
  title: z.string(),
  unit: z.string(),
  sourceSeries: z.string(),
  transformation: z.string(),
  modelVersion: z.string(),
  runDate: z.string(),
  trainingWindow: z.object({
    start: z.string(),
    end: z.string(),
    observations: z.number(),
  }),
  backtest: z.object({
    protocol: z.string(),
    origins: z.number(),
    horizons: z.array(z.number()),
    table: z.array(backtestRowSchema),
    intervalCoverage80: metricByHorizonSchema,
  }),
  selectedModel: z.string(),
  selectedModelLabel: z.string(),
  baselineModel: z.string(),
  selectionRationale: z.string(),
  history: z.array(z.tuple([z.string(), z.number()])),
  forecast: z.array(forecastPointSchema),
  disclaimer: z.string(),
  limitations: z.array(z.string()),
});

export type ForecastArtifact = z.infer<typeof forecastArtifactSchema>;

/** Load and validate one artifact; null when the model run hasn't produced it. */
export function loadArtifact(target: string): ForecastArtifact | null {
  const raw = getForecastArtifact(target);
  if (raw === null) return null;
  return forecastArtifactSchema.parse(raw);
}
