import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * About page — who built EconOS and what the project is meant to show.
 *
 * The bio is deliberately factual and third-person: established facts only,
 * no invented employers, institutions, dates, or credentials. The
 * "demonstrates" section maps each visible product surface to the capability
 * it exercises, so the page doubles as a guided tour of the codebase.
 */

export const metadata: Metadata = {
  title: "About the builder",
  description:
    "EconOS is built by Jean-Luc Saint-Fleur — an economist and data professional demonstrating economics, data engineering, and product craft in one working platform.",
};

/** One capability card in the "What EconOS demonstrates" grid. */
function CapabilityCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-lg border border-hairline bg-surface p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{body}</p>
    </li>
  );
}

export default function AboutPage() {
  return (
    <div className="pb-16">
      <PageHeader
        question="Who built this, and why?"
        title="About the builder"
        lede="EconOS is a working demonstration of economics, data engineering, and product craft — designed, built, and maintained end to end by one person."
      />

      {/* ── Bio ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="max-w-3xl space-y-4 text-base leading-relaxed text-ink-secondary">
          <p>
            Jean-Luc Saint-Fleur is an economist by academic training and a
            data and analytics professional. His work sits at the intersection
            of economic analysis and software: building data products end to
            end, from ingestion pipelines through statistical models to the
            interfaces people actually use.
          </p>
          <p>
            He is also a community development practitioner, which shapes the
            central question EconOS asks — not just what the macroeconomic
            aggregates are doing, but what those forces mean for households,
            workers, businesses, and regions. His current interests include
            applied AI and decision intelligence: systems that help people
            reason about uncertain, consequential questions rather than simply
            reporting numbers at them.
          </p>
          <p>
            EconOS is his proof of that combination in one artifact. Every
            layer — the reproducible Python pipelines, the econometric
            judgment in the research modules, the backtested forecasts, and
            the product design of the interface itself — was built by the same
            person, and all of it is open for inspection.
          </p>
        </div>
      </section>

      {/* ── What the product demonstrates, feature by feature ───────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          What EconOS demonstrates
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CapabilityCard
            title="Reproducible data pipelines"
            body="The pipelines/ directory ingests authoritative sources without API keys, validates every snapshot, and commits the results — git log is the data lineage."
          />
          <CapabilityCard
            title="Econometric judgment"
            body="The research modules apply established measures — labor-market tightness, affordability arithmetic, composite indices — with stated assumptions and a strict causal-language policy."
          />
          <CapabilityCard
            title="Validated forecasting"
            body="The forecast center publishes only models that beat a naive baseline in rolling-origin backtests, with prediction intervals derived from actual backtest errors."
          />
          <CapabilityCard
            title="Product thinking"
            body="Every page opens with the real question it answers. Features exist to serve a decision or an understanding, not to fill a dashboard."
          />
          <CapabilityCard
            title="Engineering craft"
            body="Strict TypeScript, zod-validated data contracts, unit-tested calculations, and CI quality gates — a malformed snapshot fails the build, never the reader."
          />
          <CapabilityCard
            title="Honest uncertainty"
            body="Stale data is labeled, revisions are acknowledged, intervals are shown, and limitations sections say plainly what the numbers cannot support."
          />
        </ul>
      </section>

      {/* ── Technical stack ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Technical stack
        </h2>
        <ul className="mt-4 flex max-w-3xl flex-wrap gap-2">
          {[
            "Next.js",
            "TypeScript",
            "Tailwind",
            "Recharts",
            "Zod",
            "Python",
            "statsmodels",
            "GitHub Actions",
            "Vercel",
          ].map((tool) => (
            <li
              key={tool}
              className="rounded-full border border-hairline bg-surface px-3 py-1 text-sm text-ink-secondary"
            >
              {tool}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Links & contact ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Links
        </h2>
        <ul className="mt-4 max-w-3xl space-y-2 text-base text-ink-secondary">
          <li>
            <a
              href="https://github.com/jsaintfleur/EconOS"
              className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
            >
              github.com/jsaintfleur/EconOS
            </a>{" "}
            — this project&rsquo;s source, pipelines, models, and documentation
          </li>
          <li>
            <a
              href="https://github.com/jsaintfleur"
              className="text-accent underline decoration-hairline-strong underline-offset-2 hover:text-accent-strong"
            >
              github.com/jsaintfleur
            </a>{" "}
            — other work and open-source activity
          </li>
          <li>LinkedIn — available on request</li>
          <li>Contact — via the GitHub profile above</li>
        </ul>
      </section>

      {/* ── Open source note ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div className="max-w-3xl rounded-lg border border-hairline bg-surface-raised p-5">
          <p className="text-sm leading-relaxed text-ink-secondary">
            EconOS is open source under the MIT license. Issues, questions, and
            contributions are welcome — the data registry, the methodology
            documents, and the pipelines are all designed to be read, checked,
            and improved by others.
          </p>
        </div>
      </section>
    </div>
  );
}
