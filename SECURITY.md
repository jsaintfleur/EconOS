# Security Policy

## Supported versions

Only the latest deployed version of EconOS is supported.

## Reporting a vulnerability

Please report security issues privately via GitHub security advisories on this repository
(Security → Report a vulnerability) rather than opening a public issue.

## Scope and posture

- EconOS is a read-only analytical application. It has no authentication, no user accounts, and collects no personal information.
- No secrets are committed to this repository. Any API credentials used by data pipelines are provided via environment variables (see `.env.example`).
- User-controlled inputs (calculator and simulator parameters) are validated and never rendered as HTML.
- Dependencies are reviewed via automated audit in CI.
