/**
 * Standard page header: display-serif title, supporting lede, and an optional
 * "question" line — every page answers a real economic question, and we say
 * which one out loud (product principle 9).
 */
export function PageHeader({
  title,
  lede,
  question,
}: {
  title: string;
  lede: string;
  question?: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      {question && (
        <p className="text-xs font-medium uppercase tracking-widest text-accent">
          {question}
        </p>
      )}
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-secondary">
        {lede}
      </p>
    </div>
  );
}
