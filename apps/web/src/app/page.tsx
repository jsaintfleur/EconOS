/**
 * Landing page — placeholder while the shell lands; the full landing
 * experience (featured indicators, capability tour) ships with ECONOS-008.
 */
export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
        Econ<span className="text-accent">OS</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-secondary">
        An economic intelligence platform connecting macroeconomic forces to
        the outcomes experienced by households, workers, businesses, and
        regions.
      </p>
    </div>
  );
}
