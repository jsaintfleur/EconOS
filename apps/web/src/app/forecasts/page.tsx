import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatMonth } from "@/lib/format";
import { FanChart } from "./FanChart";
import { type ForecastArtifact, loadArtifact } from "./artifact";

export const metadata: Metadata = {
  title: "Forecast Center",
  description:
    "Backtested forecasts for U.S. inflation, unemployment, and payroll growth with prediction intervals, baseline comparisons, and honest error metrics.",
};

/**
 * Forecast Center — renders the artifacts produced by models/run_forecasts.py
 * verbatim. Every number on this page (points, intervals, error tables) comes
 * from the committed artifact; the UI performs no forecasting of its own.
 */

const TARGETS = ["inflation", "unemployment", "payrolls"] as const;

/** Display formatting per target — decimals and zero-line handling. */
const TARGET_DISPLAY: Record<string, { decimals: number; zeroLine: boolean }> = {
  inflation: { decimals: 1, zeroLine: true },
  unemployment: { decimals: 1, zeroLine: false },
  payrolls: { decimals: 0, zeroLine: true },
};

function BacktestTable({ artifact }: { artifact: ForecastArtifact }) {
  const { horizons, table } = artifact.backtest;
  const decimals = TARGET_DISPLAY[artifact.target]?.decimals ?? 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">
          Rolling-origin backtest mean absolute error by model and horizon for{" "}
          {artifact.title}
        </caption>
        <thead>
          <tr className="border-b border-hairline-strong text-left text-xs uppercase tracking-wider text-muted">
            <th scope="col" className="py-2 pr-4 font-medium">
              Model
            </th>
            {horizons.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 text-right font-medium">
                MAE, {h}mo
              </th>
            ))}
            <th scope="col" className="py-2 text-right font-medium">
              Avg MAE
            </th>
          </tr>
        </thead>
        <tbody>
          {[...table]
            .sort((a, b) => a.avgMae - b.avgMae)
            .map((row) => {
              const isSelected = row.model === artifact.selectedModel;
              const isBaseline = row.model === artifact.baselineModel;
              return (
                <tr
                  key={row.model}
                  className={`border-b border-hairline ${isSelected ? "bg-accent-soft/60" : ""}`}
                >
                  <th scope="row" className="py-2 pr-4 text-left font-normal text-ink">
                    {row.label}
                    {isSelected && (
                      <span className="ml-2 rounded-sm bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-strong">
                        Selected
                      </span>
                    )}
                    {isBaseline && !isSelected && (
                      <span className="ml-2 text-[11px] text-muted">baseline</span>
                    )}
                  </th>
                  {horizons.map((h) => (
                    <td key={h} className="tabular py-2 pr-4 text-right text-ink-secondary">
                      {row.mae[String(h)]?.toFixed(decimals) ?? "—"}
                    </td>
                  ))}
                  <td className="tabular py-2 text-right font-medium text-ink">
                    {row.avgMae.toFixed(decimals)}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

function ForecastSection({ artifact }: { artifact: ForecastArtifact }) {
  const display = TARGET_DISPLAY[artifact.target] ?? { decimals: 1, zeroLine: false };
  const endPoint = artifact.forecast[artifact.forecast.length - 1];
  const selectedRow = artifact.backtest.table.find(
    (row) => row.model === artifact.selectedModel,
  );
  const twelveMonthMae = selectedRow?.mae["12"];

  return (
    <section aria-labelledby={`forecast-${artifact.target}`} className="mt-14">
      <h2
        id={`forecast-${artifact.target}`}
        className="font-display text-2xl font-semibold text-ink"
      >
        {artifact.title}
      </h2>

      {/* Headline: the 12-month-ahead point and 80% range, stated in words. */}
      {endPoint && (
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink-secondary">
          The selected model — {artifact.selectedModelLabel} — puts{" "}
          {artifact.title} at{" "}
          <span className="tabular font-semibold text-ink">
            {endPoint.value.toFixed(display.decimals)}
          </span>{" "}
          {artifact.unit} in {formatMonth(endPoint.date)}, with an 80% interval of{" "}
          <span className="tabular">
            {endPoint.p10.toFixed(display.decimals)} to{" "}
            {endPoint.p90.toFixed(display.decimals)}
          </span>
          . Intervals are empirical — they reproduce the errors this model
          actually made in {artifact.backtest.origins} historical trial runs.
        </p>
      )}

      <div className="mt-6">
        <FanChart
          title={`${artifact.title} — history and 12-month forecast`}
          subtitle={`${artifact.selectedModelLabel} · trained ${formatMonth(artifact.trainingWindow.start)}–${formatMonth(artifact.trainingWindow.end)}`}
          unit={artifact.unit}
          sourceLine={`Source: ${artifact.sourceSeries} · Model v${artifact.modelVersion} · Run ${artifact.runDate}`}
          description={`Line chart of recent ${artifact.title} history with a dashed 12-month forecast and shaded 50% and 80% prediction intervals.`}
          history={artifact.history}
          forecast={artifact.forecast}
          valueDecimals={display.decimals}
          zeroLine={display.zeroLine}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Backtest — which model earned the spot?
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            {artifact.selectionRationale} Errors below are mean absolute error
            from {artifact.backtest.origins} rolling-origin trials at each
            horizon{twelveMonthMae !== undefined && (
              <>
                {" "}
                — read the selected model&apos;s 12-month column as &ldquo;
                historically off by about{" "}
                <span className="tabular">{twelveMonthMae.toFixed(display.decimals)}</span>{" "}
                {artifact.unit} on average&rdquo;
              </>
            )}
            .
          </p>
          <div className="mt-4">
            <BacktestTable artifact={artifact} />
          </div>
        </div>

        <aside className="rounded-lg border border-hairline bg-surface-raised p-5">
          <h3 className="text-sm font-semibold text-ink">Model card</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ["Target", `${artifact.title} (${artifact.unit})`],
              ["Transformation", artifact.transformation],
              ["Selected model", artifact.selectedModelLabel],
              ["Baseline", "Naïve (last value)"],
              [
                "Training window",
                `${formatMonth(artifact.trainingWindow.start)} – ${formatMonth(artifact.trainingWindow.end)} (${artifact.trainingWindow.observations} obs.)`,
              ],
              ["Backtest", `${artifact.backtest.origins} origins × ${artifact.backtest.horizons.join("/")}-month horizons`],
              ["Model version", artifact.modelVersion],
              ["Last run", artifact.runDate],
            ].map(([term, definition]) => (
              <div key={term}>
                <dt className="text-xs uppercase tracking-wider text-muted">{term}</dt>
                <dd className="mt-0.5 text-ink-secondary">{definition}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      <details className="mt-6 rounded-lg border border-hairline bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-accent hover:text-accent-strong">
          Limitations of this forecast
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-secondary">
          {artifact.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export default function ForecastsPage() {
  const artifacts = TARGETS.map(loadArtifact).filter(
    (artifact): artifact is ForecastArtifact => artifact !== null,
  );

  return (
    <div className="pb-8">
      <PageHeader
        question="What might happen next — and how sure can we be?"
        title="Forecast Center"
        lede="Twelve-month forecasts for inflation, unemployment, and payroll growth — each backtested against a naïve baseline with rolling-origin evaluation, published with empirical prediction intervals, and selected on evidence rather than sophistication."
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Methodology summary — the contract every section below honors. */}
        <div className="mt-8 rounded-lg border border-hairline bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">How to read this page</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
            Every target compares simple baselines against classical time-series
            models. Models are refit at 60 historical origins and asked to
            forecast 1, 3, 6, and 12 months ahead; the published model is the
            one with the lowest average error that beats the naïve baseline —
            and when nothing beats the baseline, the baseline is published.
            Shaded intervals are quantiles of the errors the selected model
            actually made, so &ldquo;80%&rdquo; is a measured claim, not an
            assumption. Forecasts are statistical estimates, not guarantees.
          </p>
        </div>

        {artifacts.length === 0 ? (
          /* Empty state: artifacts not generated — say so, never fake it. */
          <div className="mt-12 rounded-lg border border-hairline bg-surface p-8 text-center">
            <p className="text-ink-secondary">
              Forecast artifacts have not been generated yet. Run{" "}
              <code className="rounded bg-surface-raised px-1.5 py-0.5 text-sm">
                python3 models/run_forecasts.py
              </code>{" "}
              to produce them.
            </p>
          </div>
        ) : (
          artifacts.map((artifact) => (
            <ForecastSection key={artifact.target} artifact={artifact} />
          ))
        )}
      </div>
    </div>
  );
}
