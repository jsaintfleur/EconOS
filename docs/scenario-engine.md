# EconOS — Interest-Rate Transmission Engine

Last updated: 2026-07-18

## Purpose

The simulator lets a user pose a change in interest rates and see estimated
consequences across housing and the broader economy — while keeping the
epistemic status of every number explicit.

## Provenance labels

Every output in the simulator carries exactly one label:

| Label | Meaning | Example |
| --- | --- | --- |
| **Direct calculation** | Arithmetic identity given user inputs | Monthly P&I payment at the new rate |
| **Historical association** | Range estimated from historical comovement of published series, with the estimation window stated | Change in housing starts per 1pp mortgage-rate change |
| **Model estimate** | Output of a documented fitted model | (reserved for future scenario versions) |
| **User assumption** | A value the user chose | Loan amount, term, rate change |
| **Economic interpretation** | Qualitative mechanism narrative | Why durables respond more than services |

## Chain modeled in v1.0

```
policy/market rate change (user assumption)
  → 30-year mortgage rate change        [historical association: pass-through]
  → monthly payment on a given loan     [direct calculation]
  → affordability (qualifying income)   [direct calculation]
  → housing activity (starts/sales)     [historical association + range]
  → residential construction employment [historical association + range]
  → consumer spending (durables)        [historical association + range, widest]
```

Uncertainty **widens down the chain** and the UI says so: payment math is
exact; employment and spending effects are presented as ranges with the
estimation basis and window displayed, never as point predictions.

## Estimation basis for associations

Associations are estimated from the same processed snapshots the rest of the
product uses (mortgage rates, starts, permits, sales, construction employment,
durable-goods spending), using simple lag-aware regressions over a stated
window, refreshed with the data pipeline. Coefficient, window, fit, and a
plain-language caveat are shown inline. Where our own estimate is weak, the
range is widened and labeled accordingly.

## What the engine deliberately does not do

- It does not claim causal identification; monetary policy is endogenous to
  the economy and rate changes historically coincide with the conditions that
  prompted them.
- It does not compound speculative effects into a single "GDP impact" number.
- It does not extrapolate beyond the range of historical rate changes without
  a warning.
