# EconOS — Release Checklist

Every production release (and v1.0.0 in particular) requires all of the
following, verified — not assumed.

## Quality gates

- [ ] `npm run lint` passes (apps/web)
- [ ] `npm run typecheck` passes (strict TypeScript)
- [ ] `npm test` passes (economic calculations + components)
- [ ] `npm run build` production build passes
- [ ] `python3 pipelines/validate/validate_processed.py` passes
- [ ] GitHub Actions CI green on the release commit
- [ ] `npm audit --audit-level=high` clean

## Content & economics

- [ ] Every metric shows source, identifier, unit, observation date
- [ ] Every forecast shows baseline comparison, backtest errors, intervals,
      and the estimates-not-guarantees statement
- [ ] Every research module has methodology and limitations sections
- [ ] Simulator outputs all carry provenance labels
- [ ] No causal language without documented basis
- [ ] No fabricated or placeholder data anywhere
- [ ] Educational-use disclaimer present in the footer

## Design & accessibility

- [ ] Desktop, tablet, and mobile layouts checked; no horizontal overflow
- [ ] Loading/empty/error/stale states render where applicable
- [ ] Keyboard-only pass: all interactions reachable, focus visible
- [ ] Headings semantic and ordered; charts carry accessible descriptions
- [ ] Light and dark modes both legible

## Security & hygiene

- [ ] No secrets in the repository or build output
- [ ] `.env.example` documents every variable
- [ ] Dependencies reviewed; no known high-severity vulnerabilities

## Deployment

- [ ] Vercel production deployment from `main` succeeds
- [ ] Every route manually verified on the live URL
- [ ] No critical console errors in production
- [ ] Metadata/Open Graph preview verified
- [ ] README updated with the live URL and screenshots
- [ ] CHANGELOG updated; release tagged (`vX.Y.Z`) with notes
