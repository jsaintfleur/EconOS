import type { SeriesSnapshot } from "@/lib/types";
import { Provenance } from "./Provenance";

/**
 * Scorecard metric card. Values are computed in page code with lib/econ and
 * passed in preformatted — this component handles presentation only.
 *
 * `tone` controls change coloring and is deliberately conservative:
 *   - "neutral" (default): no red/green — for rates, yields, policy variables
 *     and anything whose welfare interpretation is ambiguous.
 *   - "goodUp" / "goodDown": used only where interpretation is unambiguous
 *     within our framing (docs/economic-methodology.md).
 */
export interface MetricCardProps {
  label: string;
  value: string;
  /** e.g. "% YoY", "thousands", "$/hr" — always displayed, never implied. */
  unit: string;
  observationDate: string;
  change?: { text: string; direction: "up" | "down" | "flat" };
  tone?: "neutral" | "goodUp" | "goodDown";
  previousText?: string;
  /** Historical-context line, e.g. "62nd percentile since 1948". */
  contextText?: string;
  definition: string;
  interpretation: string;
  snapshot: Pick<
    SeriesSnapshot,
    "source" | "sourceId" | "sourceUrl" | "latestObservation" | "frequency" | "stale"
  >;
}

function changeColor(
  direction: "up" | "down" | "flat",
  tone: MetricCardProps["tone"],
): string {
  if (tone === "neutral" || direction === "flat") return "text-ink-secondary";
  const isGood =
    (tone === "goodUp" && direction === "up") ||
    (tone === "goodDown" && direction === "down");
  return isGood ? "text-good" : "text-bad";
}

const ARROWS = { up: "▲", down: "▼", flat: "◆" } as const;

export function MetricCard({
  label,
  value,
  unit,
  observationDate,
  change,
  tone = "neutral",
  previousText,
  contextText,
  definition,
  interpretation,
  snapshot,
}: MetricCardProps) {
  return (
    <article className="flex flex-col rounded-lg border border-hairline bg-surface p-5">
      <h3 className="text-sm font-medium text-ink-secondary">{label}</h3>

      <p className="tabular mt-2 text-3xl font-semibold tracking-tight text-ink">
        {value}
        <span className="ml-1.5 text-sm font-normal text-muted">{unit}</span>
      </p>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
        {change && (
          <span className={`tabular ${changeColor(change.direction, tone)}`}>
            <span aria-hidden="true" className="mr-1 text-[10px]">
              {ARROWS[change.direction]}
            </span>
            <span className="sr-only">
              {change.direction === "up"
                ? "Increased"
                : change.direction === "down"
                  ? "Decreased"
                  : "Unchanged"}
            </span>
            {change.text}
          </span>
        )}
        {previousText && <span className="text-muted">{previousText}</span>}
      </div>

      {contextText && (
        <p className="mt-2 text-xs text-muted">{contextText}</p>
      )}

      <p className="mt-1 text-xs text-muted">{observationDate}</p>

      {/* Definition + interpretation behind a native disclosure — accessible
          without JavaScript and keeps the card scannable. */}
      <details className="group mt-3 border-t border-hairline pt-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-accent hover:text-accent-strong">
          <span className="group-open:hidden">What is this?</span>
          <span className="hidden group-open:inline">Hide</span>
        </summary>
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-ink-secondary">
          <p>
            <span className="font-medium text-ink">Definition.</span> {definition}
          </p>
          <p>
            <span className="font-medium text-ink">How to read it.</span>{" "}
            {interpretation}
          </p>
        </div>
      </details>

      <div className="mt-auto pt-3">
        <Provenance snapshot={snapshot} />
      </div>
    </article>
  );
}
