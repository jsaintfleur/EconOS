# EconOS — Design System

Last updated: 2026-07-18

## Intent

EconOS should feel like a serious research product: intelligent, calm, precise,
trustworthy. The design system is deliberately small — one accent, one display
face, one chart component — so restraint is enforced by construction.

## Color

Tokens are defined once in `apps/web/src/app/globals.css` and exposed to
Tailwind via `@theme inline`. Light and dark palettes both derive from warm
paper neutrals.

| Token | Role |
| --- | --- |
| `background` / `surface` / `surface-raised` | Page, card, and inset surfaces |
| `ink` / `ink-secondary` / `muted` | Three-step text hierarchy |
| `hairline` / `hairline-strong` | Borders and dividers |
| `accent` (blue) | Links, active nav, primary actions — the only brand color |
| `stale` (amber) | Reserved exclusively for stale-data notices, so staleness never collides with red signal |
| `good` (green) / `bad` (red) | Used only where welfare interpretation is unambiguous |
| `chart-1..4` | Categorical chart palette (blue, red, green, black) |

Rules:

- Red/green never encode "up/down" by default; direction arrows are neutral.
  `MetricCard` requires an explicit `tone` to color a change, and the default
  is neutral (docs/economic-methodology.md, "Interpretation rules").
- Amber appears nowhere except staleness, so its meaning stays unambiguous.

## Typography

- **Inter** (`--font-sans`) for UI and body text; `tabular-nums` (`.tabular`)
  on all figures so columns of numbers align.
- **Newsreader** (`--font-display`) for page titles and the wordmark — the
  editorial serif that separates EconOS from generic dashboard templates.
- Scale: page titles `text-3xl/4xl` display; section heads `text-2xl` display
  or small-caps labels (`text-xs uppercase tracking-wider text-muted`); body
  `text-sm`/`text-base`.

## Layout

- Single content column: `mx-auto max-w-6xl px-4 sm:px-6`.
- Cards: `rounded-lg border border-hairline bg-surface p-5`. Elevation is
  expressed with hairlines, not shadows.
- Sections separated by `mt-12`–`mt-16`; no decorative dividers.
- Tables always sit inside `overflow-x-auto` wrappers — the page body never
  scrolls horizontally on mobile.

## Components

| Component | Contract |
| --- | --- |
| `PageHeader` | Question kicker (the economic question the page answers), display title, lede |
| `MetricCard` | Value + unit + previous + change + percentile context + observation date + definition + interpretation + provenance; disclosure via native `<details>` |
| `TimeSeriesChart` | Title, subtitle, unit, period, source line, accessible description, tooltip, legend — a chart cannot render without them |
| `FanChart` | TimeSeriesChart contract plus 50%/80% empirical interval bands and a forecast-start marker |
| `Provenance` | Source org (linked), original identifier, latest observation date, stale badge |

## Motion & accessibility

- Chart animation is disabled (`isAnimationActive={false}`); the only motion
  is hover/focus feedback.
- `prefers-reduced-motion` collapses all transitions globally.
- `:focus-visible` outline uses the accent color; skip-link jumps to
  `#main-content`. See docs/accessibility.md.
