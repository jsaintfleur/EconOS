# Contributing to EconOS

EconOS is a portfolio project by Jean-Luc Saint-Fleur. Issues and suggestions are welcome.

## Development workflow

1. Fork or branch from `main`.
2. Use focused, conventional commits (`feat:`, `fix:`, `docs:`, `data:`, `model:`, `test:`, `a11y:`, `perf:`, `chore:`).
3. Ensure all checks pass before opening a pull request:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `python3 pipelines/validate/validate_processed.py`
4. Open a pull request against `main` with a description of the change and its economic or product rationale.

## Standards

- **Strict TypeScript** — no `any` unless unavoidable and documented.
- **No fabricated data** — every number in the product traces to an authoritative source or a documented calculation.
- **No secrets** — configuration through environment variables only; see `.env.example`.
- **Methodology first** — any new metric, index, or model ships with its definition, formula, source, and limitations.
- **Accessibility** — keyboard navigation, semantic headings, accessible contrast, and chart descriptions are requirements, not polish.
