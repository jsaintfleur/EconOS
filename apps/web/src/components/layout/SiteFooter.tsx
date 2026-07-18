import Link from "next/link";

/**
 * Global footer: the educational-use disclaimer (a release requirement),
 * source attribution, and project links.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-semibold text-ink">
              Econ<span className="text-accent">OS</span>
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
              Connecting macroeconomic forces to the outcomes experienced by
              households, workers, businesses, and regions.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Explore
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
              {[
                ["/overview", "Overview"],
                ["/inflation", "Inflation"],
                ["/labor", "Labor"],
                ["/housing", "Housing"],
                ["/research", "Research"],
                ["/forecasts", "Forecasts"],
                ["/simulator", "Simulator"],
                ["/data", "Data & Methods"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-ink-secondary hover:text-accent"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Project
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>
                <a
                  href="https://github.com/jsaintfleur/EconOS"
                  className="text-ink-secondary hover:text-accent"
                >
                  GitHub repository
                </a>
              </li>
              <li>
                <Link href="/about" className="text-ink-secondary hover:text-accent">
                  About the builder
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-hairline pt-6">
          <p className="text-xs leading-relaxed text-muted">
            EconOS is an educational and analytical product built by Jean-Luc
            Saint-Fleur. It does not provide financial or investment advice.
            Data are drawn from authoritative public sources — U.S. Bureau of
            Labor Statistics, U.S. Bureau of Economic Analysis, U.S. Census
            Bureau, Board of Governors of the Federal Reserve System, Freddie
            Mac, University of Michigan, and S&amp;P Dow Jones Indices — via
            Federal Reserve Economic Data (FRED). Forecasts are estimates, not
            guarantees.
          </p>
        </div>
      </div>
    </footer>
  );
}
