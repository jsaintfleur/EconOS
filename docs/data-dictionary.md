# EconOS — Data Dictionary

Last updated: 2026-07-18

The machine-readable source of truth is
[`data/metadata/series_registry.json`](../data/metadata/series_registry.json);
the in-app catalog at `/data` renders it with live snapshot status. This
document summarizes the same registry for readers.

**Retrieval:** all series via FRED's public `fredgraph.csv` endpoint (no API
key), republished by FRED from the originating agency listed below. Every
snapshot records both `retrievedAt` (pipeline run date) and
`latestObservation` (newest data point).

| Internal id | Source series | Originator | Freq. | Unit |
| --- | --- | --- | --- | --- |
| real_gdp_growth | A191RL1Q225SBEA | BEA | Q | % SAAR |
| cpi_all | CPIAUCSL | BLS | M | Index 1982-84=100 |
| cpi_core | CPILFESL | BLS | M | Index 1982-84=100 |
| cpi_food | CPIUFDSL | BLS | M | Index 1982-84=100 |
| cpi_energy | CPIENGSL | BLS | M | Index 1982-84=100 |
| cpi_shelter | CUSR0000SAH1 | BLS | M | Index 1982-84=100 |
| cpi_medical | CPIMEDSL | BLS | M | Index 1982-84=100 |
| rent_primary_residence | CUSR0000SEHA | BLS | M | Index 1982-84=100 |
| unemployment_rate | UNRATE | BLS (CPS) | M | % |
| unemployed_persons | UNEMPLOY | BLS (CPS) | M | Thousands |
| payrolls | PAYEMS | BLS (CES) | M | Thousands of jobs |
| participation_rate | CIVPART | BLS (CPS) | M | % |
| avg_hourly_earnings | CES0500000003 | BLS (CES) | M | $/hour |
| job_openings | JTSJOL | BLS (JOLTS) | M | Thousands |
| quits_rate | JTSQUR | BLS (JOLTS) | M | % of employment |
| hires_rate | JTSHIR | BLS (JOLTS) | M | % of employment |
| initial_claims | ICSA | ETA | W | Claims |
| construction_employment | USCONS | BLS (CES) | M | Thousands of jobs |
| fed_funds | FEDFUNDS | Federal Reserve | M | % |
| treasury_10y | DGS10 | Federal Reserve (H.15) | D | % |
| treasury_2y | DGS2 | Federal Reserve (H.15) | D | % |
| yield_spread_10y2y | T10Y2Y | FRB St. Louis | D | pp |
| mortgage_30y | MORTGAGE30US | Freddie Mac | W | % |
| consumer_sentiment | UMCSENT | U. of Michigan | M | Index 1966:Q1=100 |
| retail_sales | RSAFS | Census | M | $ millions |
| real_pce | PCEC96 | BEA | M | $B chained 2017, SAAR |
| pce_durables | PCEDG | BEA | M | $B, SAAR |
| housing_starts | HOUST | Census/HUD | M | Thousands, SAAR |
| building_permits | PERMIT | Census/HUD | M | Thousands, SAAR |
| new_home_sales | HSN1F | Census/HUD | M | Thousands, SAAR |
| median_home_price | MSPUS | Census/HUD | Q | $ |
| case_shiller_national | CSUSHPINSA | S&P DJI | M | Index Jan 2000=100 |
| median_family_income | MEFAINUSA646N | Census | A | $ (nominal) |
| industrial_production | INDPRO | Federal Reserve (G.17) | M | Index 2017=100 |
| productivity | OPHNFB | BLS | Q | Index 2017=100 |

Per-series seasonal adjustment, geography, transformation, license, plausible
validation ranges, and known limitations live in the registry JSON and on the
`/data` page.

## Derived measures

Documented in [economic-methodology.md](economic-methodology.md) and computed
in `apps/web/src/lib/econ.ts`: YoY percent change, period change, percentile
rank, exact real growth, purchasing power, mortgage payment, EconOS Housing
Affordability Index, labor-market tightness (V/U).

Forecast artifacts under `data/processed/forecasts/` are documented in
[forecasting-methodology.md](forecasting-methodology.md).
