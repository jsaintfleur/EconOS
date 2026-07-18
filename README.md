# EconOS

**An economic intelligence platform that connects macroeconomic forces to the real-world outcomes experienced by households, workers, businesses, industries, and regions.**

> EconOS is an educational and analytical product. It does not provide financial or investment advice.

## What EconOS answers

- **What is happening in the U.S. economy?** — a curated, sourced economic scorecard, not a wall of disconnected charts.
- **Who is affected, and how much?** — inflation translated into household purchasing power, rates translated into mortgage payments, labor conditions translated into worker outcomes.
- **What does theory say?** — research modules grounded in established economics (Okun's Law, the Beveridge Curve, real wages, interest-rate transmission) with documented methodology and limitations.
- **What might happen next?** — transparent, backtested forecasts with prediction intervals and honest error metrics.
- **What if conditions change?** — an interest-rate transmission simulator that distinguishes direct calculation from historical association from user assumption.

## Status

🚧 **In active development toward v1.0.0.** See [CHANGELOG.md](CHANGELOG.md) and [docs/backlog.md](docs/backlog.md) for progress.

## Architecture

```
EconOS/
├── apps/web/          # Next.js (App Router, strict TypeScript, Tailwind)
├── pipelines/         # Python data ingestion, validation, publication
├── models/            # Forecasting and scenario models
├── data/
│   ├── metadata/      # Series registry — source of truth for every series
│   └── processed/     # Committed JSON snapshots consumed by the app
├── docs/              # Product, methodology, and architecture documentation
└── tests/             # Data and economic-logic tests
```

**Data flow:** authoritative public sources (FRED, BLS, BEA, Census, Freddie Mac) → Python ingestion with validation → committed processed snapshots with full metadata → statically generated pages. Every series records its source, identifier, frequency, units, retrieval date, and latest observation date.

## Data sources

All data comes from authoritative public sources: Federal Reserve Economic Data (FRED), the Bureau of Labor Statistics, the Bureau of Economic Analysis, the U.S. Census Bureau, Freddie Mac, and the U.S. Treasury. See [docs/data-dictionary.md](docs/data-dictionary.md) for the full catalog.

No API keys are required for the committed snapshot pipeline. No secrets are committed.

## Local setup

```bash
# Web application
cd apps/web
npm install
npm run dev        # http://localhost:3000

# Data refresh (Python 3.11+)
python3 pipelines/ingest/fetch_fred.py     # refresh FRED-sourced snapshots
python3 pipelines/validate/validate_processed.py  # validate outputs
```

## Testing

```bash
cd apps/web
npm run lint       # ESLint
npm run typecheck  # strict TypeScript
npm test           # Vitest unit tests (economic calculations, components)
npm run build      # production build
python3 pipelines/validate/validate_processed.py  # data validation
```

## Methodology

Every metric, index, and forecast documents its definition, formula, source, transformation, and limitations. Forecasts are backtested with rolling-origin evaluation against naïve baselines, and are presented with prediction intervals. Correlation is not presented as causation. See the in-app **Data & Methods** section and [docs/economic-methodology.md](docs/economic-methodology.md).

## Author

**Jean-Luc Saint-Fleur** — economist by training, data and analytics professional, builder of data products.

- GitHub: [@jsaintfleur](https://github.com/jsaintfleur)

## License

[MIT](LICENSE)
