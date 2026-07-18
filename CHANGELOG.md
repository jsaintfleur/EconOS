# Changelog

All notable changes to EconOS are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/), and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Repository foundation: license, contribution guide, security policy, documentation structure.
- Data platform: registry of 35 series with full governance metadata, keyless FRED ingestion, validation gates, committed snapshots current through July 2026.
- Design system and application shell: warm-neutral tokens, light/dark, accessible navigation, chart contract components.
- Economic Observatory: landing page, 16-indicator overview scorecard, inflation, labor, and housing modules with purchasing-power and mortgage calculators and a documented Housing Affordability Index.
- Research Lab: real wages, Okun's Law, Beveridge Curve, and interest-rate transmission modules with computed findings and limitations.
- Forecast Center: rolling-origin backtested forecasts (inflation, unemployment, payrolls) with empirical intervals and honest baseline selection.
- Interest-Rate Transmission Simulator with provenance-labeled scenario cascade.
- Data & Methods center, About page, CI (lint/typecheck/test/build/validate/audit), scheduled data-refresh workflow that opens reviewable PRs.

### Fixed
- Year-over-year calculations match base observations by calendar date, so windows spanning the skipped October 2025 federal releases are dropped rather than silently stretched to 13 months.
