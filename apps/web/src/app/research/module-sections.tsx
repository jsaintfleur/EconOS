import Link from "next/link";

/**
 * Shared layout pieces for the research module template. Every module page
 * follows the same eight-section structure — Question → Theory → Data →
 * Method → Findings → Uncertainty → Limitations → Reproduce — with these
 * exact words as <h2> headings, so readers can navigate any module the same
 * way. Server components; no state.
 */

/** One template section: fixed h2 heading, prose-width paragraphs. */
export function ModuleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-sm leading-relaxed text-ink-secondary [&>p]:max-w-3xl [&>ul]:max-w-3xl">
        {children}
      </div>
    </section>
  );
}

/** A row of computed headline statistics inside the Findings section. */
export function FindingStats({
  items,
}: {
  items: Array<{ label: string; value: string; detail: string }>;
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-hairline bg-surface p-4">
          <dt className="text-xs font-medium text-ink-secondary">{item.label}</dt>
          <dd className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-ink">
            {item.value}
          </dd>
          <dd className="mt-1 text-xs leading-relaxed text-muted">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Standard closing section: where the calculation lives and how to rerun it. */
export function ReproduceSection({ modulePath }: { modulePath: string }) {
  return (
    <ModuleSection title="Reproduce">
      <p>
        The calculation lives in{" "}
        <code className="rounded-sm bg-surface-raised px-1 py-0.5 text-[13px] text-ink">
          {modulePath}
        </code>{" "}
        and uses <code className="rounded-sm bg-surface-raised px-1 py-0.5 text-[13px] text-ink">lib/econ</code>;
        every number on this page is recomputed from the committed snapshots on each build.
        Data series and vintages are listed on the{" "}
        <Link
          href="/data"
          className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
        >
          Data page
        </Link>
        .
      </p>
    </ModuleSection>
  );
}
