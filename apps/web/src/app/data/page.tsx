import { Fragment } from "react";
import type { Metadata } from "next";
import { getCatalog } from "@/lib/data";
import { formatFullDate, formatNumber, formatObservationDate } from "@/lib/format";
import type { CatalogEntry, Frequency } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { StaleBadge } from "@/components/ui/Provenance";

/**
 * Data & Methods center — the transparency page behind every number on the
 * site. It renders the full data catalog (registry metadata + snapshot
 * status from catalog.json), explains the pipeline in plain language, and
 * documents transformations, vintages, licensing, and known limitations.
 *
 * Everything here is computed from the committed catalog at build time —
 * counts, freshness dates, and stale markers are derived, never asserted
 * (docs/architecture.md, "Honest freshness").
 */

export const metadata: Metadata = {
  title: "Data & Methods",
  description:
    "Where every number in EconOS comes from: the full data catalog with sources, coverage, and freshness; the ingestion pipeline; transformations; revisions policy; licensing; and known limitations.",
};

/** Spelled-out labels for the registry's single-letter frequency codes. */
const FREQUENCY_LABELS: Record<Frequency, string> = {
  D: "Daily",
  W: "Weekly",
  M: "Monthly",
  Q: "Quarterly",
  A: "Annual",
};

/**
 * Compact seasonal-adjustment labels for the table. Falls back to the raw
 * registry string so a new adjustment value degrades to verbose, not wrong.
 */
const ADJUSTMENT_ABBREVIATIONS: Record<string, string> = {
  "Seasonally adjusted": "SA",
  "Not seasonally adjusted": "NSA",
  "Seasonally adjusted annual rate": "SAAR",
  "Not applicable": "—",
};

function abbreviateAdjustment(adjustment: string): string {
  return ADJUSTMENT_ABBREVIATIONS[adjustment] ?? adjustment;
}

/** "1948–2026" style coverage span from first/latest observation dates. */
function coverageYears(entry: CatalogEntry): string {
  if (!entry.firstObservation || !entry.latestObservation) return "—";
  const first = entry.firstObservation.slice(0, 4);
  const last = entry.latestObservation.slice(0, 4);
  return first === last ? first : `${first}–${last}`;
}

/** Section wrapper: consistent width, rhythm, and heading treatment. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One cell in the freshness summary strip. */
function FreshnessStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1.5 text-lg font-semibold tracking-tight text-ink">
        {value}
      </p>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
    </div>
  );
}

export default function DataPage() {
  const catalog = getCatalog();
  const { series } = catalog;

  // ── Freshness summary, computed from the catalog ────────────────────────
  const sourceNames = [...new Set(series.map((entry) => entry.source))].sort(
    (a, b) => a.localeCompare(b),
  );
  const staleCount = series.filter((entry) => entry.stale).length;

  // Freshness spread among monthly-and-slower series only: daily/weekly
  // series are always near-current, so including them would make "newest"
  // trivially today and hide the real publication-lag spread.
  const monthlyPlus = series.filter(
    (entry) =>
      (entry.frequency === "M" ||
        entry.frequency === "Q" ||
        entry.frequency === "A") &&
      entry.latestObservation !== undefined,
  );
  const byLatest = [...monthlyPlus].sort((a, b) =>
    (a.latestObservation ?? "").localeCompare(b.latestObservation ?? ""),
  );
  const oldestEntry = byLatest[0];
  const newestEntry = byLatest[byLatest.length - 1];

  // ── Catalog grouping: alphabetical by originating source ────────────────
  const grouped = sourceNames.map((source) => ({
    source,
    entries: series
      .filter((entry) => entry.source === source)
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
  }));

  return (
    <div className="pb-16">
      <PageHeader
        question="Where does every number come from?"
        title="Data & Methods"
        lede="Every figure in EconOS traces to an authoritative public source through a reproducible pipeline. This page is the complete inventory: what we collect, how it is validated, how it is transformed, and what its limits are."
      />

      {/* ── The pipeline, in plain language ─────────────────────────────── */}
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-8 text-base leading-relaxed text-ink-secondary sm:px-6">
        <p className="max-w-3xl">
          Data flows through four stages. First, series are retrieved from
          authoritative sources — the Bureau of Labor Statistics, the Bureau of
          Economic Analysis, the Census Bureau, the Federal Reserve, and others
          — using FRED&rsquo;s public, keyless CSV endpoint, so no credentials
          are needed to reproduce any snapshot. Second, every retrieval passes
          validation gates: schema conformance, date continuity, and plausible
          value ranges. Third, validated data is committed to the repository as
          compact JSON snapshots that record both the retrieval date (when we
          fetched it) and the observation date (what the data actually covers).
          Fourth, the site is statically built from those committed snapshots —
          there is no runtime database and no request-time fetching.
        </p>
        <p className="max-w-3xl">
          When a refresh fails, the pipeline keeps the last validated snapshot
          and marks the series stale rather than fabricating or interpolating
          values. Staleness is computed from the data, surfaced in the
          interface, and never hidden. The full ingestion and validation code
          is public in the{" "}
          <a
            href="https://github.com/jsaintfleur/EconOS/tree/main/pipelines"
            className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
          >
            pipelines directory
          </a>{" "}
          of the repository — <code className="text-sm">git log</code> is the
          data lineage.
        </p>
      </div>

      {/* ── Freshness summary strip ─────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <FreshnessStat
            label="Series"
            value={formatNumber(series.length)}
            detail="in the catalog"
          />
          <FreshnessStat
            label="Sources"
            value={formatNumber(sourceNames.length)}
            detail="originating organizations"
          />
          <FreshnessStat
            label="Newest observation"
            value={
              newestEntry?.latestObservation
                ? formatObservationDate(
                    newestEntry.latestObservation,
                    newestEntry.frequency,
                  )
                : "—"
            }
            detail="among monthly and slower series"
          />
          <FreshnessStat
            label="Oldest observation"
            value={
              oldestEntry?.latestObservation
                ? formatObservationDate(
                    oldestEntry.latestObservation,
                    oldestEntry.frequency,
                  )
                : "—"
            }
            detail={
              oldestEntry ? `${oldestEntry.displayName} (publication lag)` : undefined
            }
          />
          <FreshnessStat
            label="Snapshot generated"
            value={formatFullDate(catalog.generatedAt)}
            detail="last pipeline run"
          />
          <FreshnessStat
            label="Stale series"
            value={
              staleCount > 0 ? (
                <>
                  {formatNumber(staleCount)}
                  <StaleBadge />
                </>
              ) : (
                "0"
              )
            }
            detail={
              staleCount > 0
                ? "last refresh failed for these"
                : "all refreshes succeeded"
            }
          />
        </div>
      </div>

      {/* ── The full data catalog, grouped by source ────────────────────── */}
      <Section title="Data catalog">
        <p className="max-w-3xl text-sm leading-relaxed text-ink-secondary">
          Every series the platform uses, grouped by originating source. The
          identifier under each name links to the source page on FRED; the
          muted line beneath each row is that series&rsquo; honest limitation,
          carried from the registry.
        </p>

        {/* Horizontal scroll wrapper keeps the table usable on mobile. */}
        <div className="mt-6 overflow-x-auto rounded-lg border border-hairline bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline-strong text-xs uppercase tracking-wider text-muted">
                <th scope="col" className="px-4 py-3 font-medium">
                  Series
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Frequency
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Unit
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Adjustment
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Coverage
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Latest observation
                </th>
              </tr>
            </thead>
            {grouped.map(({ source, entries }) => (
              <tbody key={source}>
                {/* Source group header row */}
                <tr className="border-b border-hairline bg-surface-raised">
                  <th
                    scope="colgroup"
                    colSpan={6}
                    className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-ink-secondary"
                  >
                    {source}
                  </th>
                </tr>
                {entries.map((entry) => (
                  // Each series renders as a pair of rows: the data row and a
                  // muted limitations row. The bottom border lives on the
                  // limitations row so the pair reads as one unit.
                  <Fragment key={entry.id}>
                    <tr>
                      <td className="px-4 pt-3 align-top">
                        <span className="font-medium text-ink">
                          {entry.displayName}
                        </span>
                        {entry.stale && <StaleBadge />}
                        <span className="block">
                          <a
                            href={entry.sourceUrl}
                            className="text-xs text-muted underline decoration-hairline-strong underline-offset-2 hover:text-accent"
                          >
                            {entry.sourceId}
                          </a>
                        </span>
                      </td>
                      <td className="px-4 pt-3 align-top text-ink-secondary">
                        {FREQUENCY_LABELS[entry.frequency]}
                      </td>
                      <td className="px-4 pt-3 align-top text-ink-secondary">
                        {entry.unit}
                      </td>
                      <td className="px-4 pt-3 align-top text-ink-secondary">
                        {abbreviateAdjustment(entry.seasonalAdjustment)}
                      </td>
                      <td className="px-4 pt-3 align-top text-ink-secondary">
                        {coverageYears(entry)}
                      </td>
                      <td className="px-4 pt-3 align-top text-ink-secondary">
                        {entry.latestObservation
                          ? formatObservationDate(
                              entry.latestObservation,
                              entry.frequency,
                            )
                          : "—"}
                      </td>
                    </tr>
                    <tr className="border-b border-hairline">
                      <td colSpan={6} className="px-4 pb-3 pt-1">
                        <span className="text-xs leading-relaxed text-muted">
                          {entry.limitations}
                        </span>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Section>

      {/* ── Standard transformations ────────────────────────────────────── */}
      <Section title="Transformations">
        <p className="max-w-3xl text-base leading-relaxed text-ink-secondary">
          Raw series are transformed with a small, documented set of standard
          calculations, each implemented in the calculation library and covered
          by unit tests (docs/economic-methodology.md).
        </p>
        <ul className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed text-ink-secondary">
          <li className="rounded-lg border border-hairline bg-surface p-4">
            <span className="font-medium text-ink">
              Year-over-year percent change.
            </span>{" "}
            <code className="text-xs">
              yoy&#8348; = (X&#8348; / X&#8348;&#8331;&#8321;&#8322;&#8342; − 1)
              × 100
            </code>{" "}
            for monthly indices (CPI, average hourly earnings, retail sales);
            for quarterly series the lag is four quarters.
          </li>
          <li className="rounded-lg border border-hairline bg-surface p-4">
            <span className="font-medium text-ink">
              Month-over-month difference.
            </span>{" "}
            The change in level from the prior month — for example, the payroll
            change in thousands of jobs, the same measure reported in the
            monthly Employment Situation.
          </li>
          <li className="rounded-lg border border-hairline bg-surface p-4">
            <span className="font-medium text-ink">Historical percentile.</span>{" "}
            The percentile of the latest value within the series&rsquo; full
            published history (or a stated window). This answers &ldquo;how
            unusual is this?&rdquo; without imposing a good/bad judgment.
          </li>
          <li className="rounded-lg border border-hairline bg-surface p-4">
            <span className="font-medium text-ink">Real growth.</span> Nominal
            growth minus CPI inflation over the same window — the standard
            first-order approximation for small rates. Where compounding
            matters (the purchasing-power calculator), the exact ratio form{" "}
            <code className="text-xs">((1 + w) / (1 + π)) − 1</code> is used
            instead.
          </li>
          <li className="rounded-lg border border-hairline bg-surface p-4">
            <span className="font-medium text-ink">Monthly averaging.</span>{" "}
            Weekly and daily series (mortgage rates, Treasury yields, initial
            claims) are averaged to calendar months when compared against
            monthly series, so cross-frequency comparisons align on the same
            time step.
          </li>
        </ul>
      </Section>

      {/* ── Revisions & vintages ────────────────────────────────────────── */}
      <Section title="Revisions & vintages">
        <div className="max-w-3xl space-y-4 text-base leading-relaxed text-ink-secondary">
          <p>
            EconOS displays current-vintage data: FRED serves the latest
            revised values, and snapshots capture whatever the source has most
            recently published. Many series revise after first release —
            payrolls receive two monthly revisions plus annual benchmarking,
            and GDP advance estimates can change substantially — so the numbers
            shown here may differ from what was first reported.
          </p>
          <p>
            The platform says this out loud rather than pretending otherwise:
            real-time (first-release) analysis is out of scope for v1.0 and is
            noted as a limitation wherever it matters, including in the
            forecast backtests, where using today&rsquo;s revised data
            overstates the accuracy achievable in real time.
          </p>
        </div>
      </Section>

      {/* ── Licensing ───────────────────────────────────────────────────── */}
      <Section title="Licensing">
        <div className="max-w-3xl space-y-4 text-base leading-relaxed text-ink-secondary">
          <p>
            Most series are produced by U.S. federal statistical agencies — the
            Bureau of Labor Statistics, the Bureau of Economic Analysis, the
            Census Bureau, and the Federal Reserve — and are in the public
            domain as works of the U.S. government.
          </p>
          <p>
            Three sources are not federal works: the Freddie Mac Primary
            Mortgage Market Survey, the University of Michigan Surveys of
            Consumers, and the S&amp;P CoreLogic Case-Shiller indices from
            S&amp;P Dow Jones Indices. These are redistributed via FRED under
            their providers&rsquo; terms and are always displayed with source
            citation. The per-series license is recorded in the series registry
            and carried into every snapshot.
          </p>
        </div>
      </Section>

      {/* ── Known limitations ───────────────────────────────────────────── */}
      <Section title="Known limitations">
        <p className="max-w-3xl text-base leading-relaxed text-ink-secondary">
          Honest caveats that apply across the platform, beyond the per-series
          notes in the catalog above.
        </p>
        <ul className="mt-4 max-w-3xl list-disc space-y-3 pl-5 text-sm leading-relaxed text-ink-secondary">
          <li>
            <span className="font-medium text-ink">National averages.</span>{" "}
            Nearly every series is a U.S. aggregate. National figures mask wide
            variation across regions, industries, and households — no single
            household experiences &ldquo;the&rdquo; inflation rate.
          </li>
          <li>
            <span className="font-medium text-ink">Survey error.</span> Many
            headline measures come from sample surveys with meaningful
            month-to-month noise: the household survey behind the unemployment
            rate, the wide confidence intervals on monthly housing starts, and
            sentiment surveys sensitive to salient prices.
          </li>
          <li>
            <span className="font-medium text-ink">Revisions.</span> As
            described above, current-vintage data means early readings can and
            do change; single-month moves should be read with corresponding
            caution.
          </li>
          <li>
            <span className="font-medium text-ink">
              The late-2025 release gap.
            </span>{" "}
            The disruption to federal statistical agencies in late 2025 delayed
            some scheduled releases and left others unpublished. Affected
            series carry a gap in their histories; the pipeline preserves those
            gaps rather than interpolating values that were never published.
          </li>
        </ul>
      </Section>
    </div>
  );
}
