/**
 * Compact "current conditions" strip for the landing hero: four real,
 * dated figures in place of a decorative hero image. Purely presentational —
 * the landing page computes each figure with lib/econ and passes it in
 * preformatted, keeping all arithmetic out of components.
 */

export interface ConditionFigure {
  /** What the number is, e.g. "Inflation (CPI, YoY)". */
  label: string;
  /** Preformatted value, e.g. "3.7%". */
  value: string;
  /** Observation period the value covers, e.g. "Jun 2026". */
  date: string;
}

export function ConditionsStrip({ figures }: { figures: ConditionFigure[] }) {
  return (
    <section aria-label="Current economic conditions">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted">
        Current conditions
      </h2>
      {/* A definition list is the right semantics: each label describes the
          value that follows it. */}
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="bg-surface px-5 py-4">
            <dt className="text-xs text-ink-secondary">{figure.label}</dt>
            <dd className="mt-1">
              <span className="tabular text-2xl font-semibold tracking-tight text-ink">
                {figure.value}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{figure.date}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
