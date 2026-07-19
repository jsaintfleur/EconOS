import Link from "next/link";

/**
 * One card in the "What EconOS answers" grid: a product layer, the economic
 * question it exists to answer, and the route where it lives. The question is
 * the headline — product principle 9: every page answers a real question,
 * and we say which one out loud.
 */

export interface LayerCardProps {
  /** Layer name, e.g. "Observatory". */
  name: string;
  /** The economic question the layer answers. */
  question: string;
  /** One sentence on how the layer answers it. */
  description: string;
  href: string;
  /** Link text, e.g. "Open the overview". */
  linkLabel: string;
}

export function LayerCard({
  name,
  question,
  description,
  href,
  linkLabel,
}: LayerCardProps) {
  return (
    <article className="flex flex-col rounded-lg border border-hairline bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-widest text-accent">
        {name}
      </p>
      <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-ink">
        {question}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
        {description}
      </p>
      <p className="mt-auto pt-4">
        <Link
          href={href}
          className="text-sm font-medium text-accent hover:text-accent-strong"
        >
          {linkLabel}
          <span aria-hidden="true"> →</span>
        </Link>
      </p>
    </article>
  );
}
