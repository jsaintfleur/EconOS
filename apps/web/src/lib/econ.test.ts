import { describe, expect, it } from "vitest";
import {
  alignSeries,
  housingAffordabilityIndex,
  latest,
  monthlyMortgagePayment,
  ols,
  percentileRank,
  periodChange,
  previous,
  purchasingPower,
  realGrowthRate,
  since,
  vacancyUnemploymentRatio,
  yoyPercentChange,
  zScores,
} from "./econ";
import type { Observation } from "./types";

/** 14 months of a synthetic index that grows 1%/month. */
function syntheticMonthlyIndex(): Observation[] {
  const observations: Observation[] = [];
  let value = 100;
  for (let month = 0; month < 14; month += 1) {
    const year = 2024 + Math.floor(month / 12);
    const mm = String((month % 12) + 1).padStart(2, "0");
    observations.push([`${year}-${mm}-01`, value]);
    value *= 1.01;
  }
  return observations;
}

describe("latest / previous", () => {
  const observations: Observation[] = [
    ["2026-04-01", 1],
    ["2026-05-01", 2],
    ["2026-06-01", 3],
  ];

  it("returns the newest and stepped-back observations", () => {
    expect(latest(observations)).toEqual(["2026-06-01", 3]);
    expect(previous(observations)).toEqual(["2026-05-01", 2]);
    expect(previous(observations, 2)).toEqual(["2026-04-01", 1]);
  });

  it("returns null out of range", () => {
    expect(latest([])).toBeNull();
    expect(previous(observations, 5)).toBeNull();
  });
});

describe("yoyPercentChange", () => {
  it("computes 12-month growth for a compounding index", () => {
    const yoy = yoyPercentChange(syntheticMonthlyIndex());
    // 1.01^12 − 1 = 12.6825...%
    expect(yoy).toHaveLength(2);
    expect(yoy[0][1]).toBeCloseTo(12.6825, 3);
    expect(yoy[0][0]).toBe("2025-01-01");
  });

  it("supports quarterly lag", () => {
    const quarterly: Observation[] = [
      ["2025-01-01", 100],
      ["2025-04-01", 101],
      ["2025-07-01", 102],
      ["2025-10-01", 103],
      ["2026-01-01", 110],
    ];
    const yoy = yoyPercentChange(quarterly, 4);
    expect(yoy).toEqual([["2026-01-01", 10.000000000000009]]);
  });
});

describe("periodChange", () => {
  it("differences consecutive observations", () => {
    const changes = periodChange([
      ["2026-04-01", 159000],
      ["2026-05-01", 159100],
      ["2026-06-01", 159050],
    ]);
    expect(changes).toEqual([
      ["2026-05-01", 100],
      ["2026-06-01", -50],
    ]);
  });
});

describe("percentileRank", () => {
  const history = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("places the median at 50 and extremes near the tails", () => {
    expect(percentileRank(history, 5)).toBeCloseTo(45); // midrank of the tie
    expect(percentileRank(history, 10)).toBeCloseTo(95);
    expect(percentileRank(history, 0)).toBe(0);
    expect(percentileRank(history, 11)).toBe(100);
  });

  it("handles empty history", () => {
    expect(percentileRank([], 5)).toBeNaN();
  });
});

describe("realGrowthRate", () => {
  it("uses the exact ratio form, not the subtraction approximation", () => {
    // 5% nominal, 3% inflation → 1.05/1.03 − 1 = 1.9417%
    expect(realGrowthRate(5, 3)).toBeCloseTo(1.9417, 3);
    // Approximation error vs (5 − 3 = 2) should be visible
    expect(realGrowthRate(5, 3)).not.toBeCloseTo(2, 3);
  });

  it("is zero when wages exactly track prices", () => {
    expect(realGrowthRate(4, 4)).toBeCloseTo(0, 10);
  });
});

describe("purchasingPower", () => {
  it("deflates dollars by the CPI ratio", () => {
    // Prices doubled → $100 buys half as much
    expect(purchasingPower(100, 150, 300)).toBeCloseTo(50);
    // No price change → unchanged
    expect(purchasingPower(100, 200, 200)).toBeCloseTo(100);
  });
});

describe("monthlyMortgagePayment", () => {
  it("matches the standard amortization result", () => {
    // Canonical check: $300,000 at 6% for 30 years = $1,798.65/month
    expect(monthlyMortgagePayment(300000, 6, 30)).toBeCloseTo(1798.65, 1);
  });

  it("degenerates to simple division at 0%", () => {
    expect(monthlyMortgagePayment(360000, 0, 30)).toBeCloseTo(1000);
  });

  it("is increasing in the rate", () => {
    const low = monthlyMortgagePayment(400000, 3, 30);
    const high = monthlyMortgagePayment(400000, 7, 30);
    expect(high).toBeGreaterThan(low);
  });

  it("rejects nonsense inputs", () => {
    expect(monthlyMortgagePayment(0, 6, 30)).toBeNaN();
    expect(monthlyMortgagePayment(100000, 6, 0)).toBeNaN();
  });
});

describe("housingAffordabilityIndex", () => {
  it("returns 100 exactly at the qualifying boundary", () => {
    // Construct income so that 28% of monthly income equals the payment.
    const price = 400000;
    const rate = 6.5;
    const loan = price * 0.8;
    const payment = monthlyMortgagePayment(loan, rate, 30);
    const income = (payment / 0.28) * 12;
    expect(housingAffordabilityIndex(price, income, rate)).toBeCloseTo(100, 6);
  });

  it("falls when rates rise, holding price and income fixed", () => {
    const at5 = housingAffordabilityIndex(400000, 100000, 5);
    const at8 = housingAffordabilityIndex(400000, 100000, 8);
    expect(at8).toBeLessThan(at5);
  });
});

describe("vacancyUnemploymentRatio", () => {
  it("computes openings per unemployed person", () => {
    expect(vacancyUnemploymentRatio(8000, 6400)).toBeCloseTo(1.25);
    expect(vacancyUnemploymentRatio(8000, 0)).toBeNaN();
  });
});

describe("zScores", () => {
  it("standardizes to mean 0 and unit variance", () => {
    const scores = zScores([2, 4, 6, 8]);
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    expect(mean).toBeCloseTo(0, 10);
    expect(scores[0]).toBeCloseTo(-1.3416, 3);
    expect(scores[3]).toBeCloseTo(1.3416, 3);
  });

  it("returns zeros for a constant series", () => {
    expect(zScores([5, 5, 5])).toEqual([0, 0, 0]);
  });
});

describe("alignSeries / since", () => {
  it("aligns on shared dates only", () => {
    const a: Observation[] = [
      ["2026-01-01", 1],
      ["2026-02-01", 2],
    ];
    const b: Observation[] = [
      ["2026-02-01", 20],
      ["2026-03-01", 30],
    ];
    expect(alignSeries(a, b)).toEqual([["2026-02-01", 2, 20]]);
  });

  it("trims by ISO date", () => {
    const series: Observation[] = [
      ["2025-12-01", 1],
      ["2026-01-01", 2],
    ];
    expect(since(series, "2026-01-01")).toEqual([["2026-01-01", 2]]);
  });
});

describe("ols", () => {
  it("recovers a known linear relationship", () => {
    // y = 3 + 2x exactly → slope 2, intercept 3, R² = 1
    const pairs: Array<[number, number]> = [1, 2, 3, 4, 5].map((x) => [x, 3 + 2 * x]);
    const fit = ols(pairs);
    expect(fit.slope).toBeCloseTo(2, 10);
    expect(fit.intercept).toBeCloseTo(3, 10);
    expect(fit.r2).toBeCloseTo(1, 10);
  });

  it("refuses degenerate inputs", () => {
    expect(ols([[1, 2]]).slope).toBeNaN();
    expect(
      ols([
        [1, 5],
        [1, 6],
        [1, 7],
      ]).slope,
    ).toBeNaN();
  });
});
