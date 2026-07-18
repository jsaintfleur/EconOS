# EconOS — Accessibility

Last updated: 2026-07-18

EconOS targets WCAG 2.1 AA-aligned behavior. Accessibility is treated as a
release gate (see docs/release-checklist.md), not polish.

## Implemented

- **Skip link** to `#main-content` as the first focusable element.
- **Semantic structure**: one `h1` per page, ordered heading levels, `nav`
  with `aria-label`, `figure`/`figcaption` for charts, `dl` for model cards,
  real `table` markup with `caption`/`scope` for data tables.
- **Keyboard**: all interactions are native elements (links, buttons,
  `details/summary`, form controls) — nothing requires a pointer. Visible
  `:focus-visible` outline on every interactive element.
- **Charts**: every chart container carries `role="img"` with a written
  `aria-label` description of what the chart shows; legends and axis labels
  are text, not color alone; series are distinguished by color *and* dash
  pattern where overlaid.
- **Non-color indicators**: direction arrows accompany any colored change
  value, with visually hidden "Increased/Decreased" text for screen readers;
  staleness is a labeled badge, not a color dot.
- **Forms**: every calculator input has a programmatically associated
  `<label>`; ranges are constrained; units are stated in the label.
- **Contrast**: token pairs (ink on background/surface, muted on surface,
  accent-strong on accent-soft) chosen for ≥4.5:1 in both light and dark
  palettes.
- **Reduced motion**: global `prefers-reduced-motion` override; chart
  animations disabled outright.
- **Mobile**: no horizontal page overflow; wide tables scroll within their
  own container; disclosure menu for navigation with `aria-expanded`/
  `aria-controls`.

## Known gaps (tracked for hardening)

- Chart data is described in summary form, not exposed as an accessible data
  table alternative; a per-chart "view as table" affordance is a roadmap item.
- Recharts tooltips are mouse/touch-driven; keyboard users receive the same
  information via the chart description and the surrounding text, but not
  point-by-point.
- No automated axe audit in CI yet; manual checks per release.
