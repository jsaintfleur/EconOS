import type { SeriesSnapshot } from "@/lib/types";
import { formatFullDate, formatObservationDate } from "@/lib/format";

/**
 * Provenance line shown under every metric and chart: originating source,
 * original identifier, latest observation date (what the data covers), and
 * a stale marker when the last refresh failed. Traceability is a product
 * principle — nothing renders without its source.
 */
export function Provenance({
  snapshot,
  className = "",
}: {
  snapshot: Pick<
    SeriesSnapshot,
    "source" | "sourceId" | "sourceUrl" | "latestObservation" | "frequency" | "stale"
  >;
  className?: string;
}) {
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      <a
        href={snapshot.sourceUrl}
        className="underline decoration-hairline-strong underline-offset-2 hover:text-accent"
      >
        {snapshot.source}
      </a>{" "}
      via FRED ({snapshot.sourceId}) · Latest:{" "}
      {formatObservationDate(snapshot.latestObservation, snapshot.frequency)}
      {snapshot.stale && <StaleBadge />}
    </p>
  );
}

/** Amber stale marker — the only place the stale color is used. */
export function StaleBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-sm bg-stale-soft px-1.5 py-0.5 text-[11px] font-medium text-stale">
      <svg aria-hidden="true" viewBox="0 0 8 8" className="h-1.5 w-1.5 fill-current">
        <circle cx="4" cy="4" r="4" />
      </svg>
      Stale — last refresh failed
    </span>
  );
}

/** Retrieval-date note for the Data & Methods page. */
export function RetrievedNote({ retrievedAt }: { retrievedAt: string }) {
  return (
    <span className="text-xs text-muted">
      Retrieved {formatFullDate(retrievedAt)}
    </span>
  );
}
