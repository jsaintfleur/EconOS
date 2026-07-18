import { describe, expect, it } from "vitest";
import type { Observation } from "@/lib/types";
import {
  addMonths,
  changeOverMonths,
  cumulativeRealIndex,
  laggedPairs,
  monthlyAverage,
  percentChangeOverMonths,
  quarterlyAverage,
} from "./transforms";

describe("addMonths", () => {
  it("adds and subtracts across year boundaries", () => {
    expect(addMonths("2025-11", -12)).toBe("2024-11");
    expect(addMonths("2026-01", -6)).toBe("2025-07");
    expect(addMonths("2025-12", 1)).toBe("2026-01");
  });
});

describe("monthlyAverage", () => {
  it("averages weekly observations within each month", () => {
    const weekly: Observation[] = [
      ["2026-01-02", 6.0],
      ["2026-01-09", 7.0],
      ["2026-02-06", 5.0],
    ];
    expect(monthlyAverage(weekly)).toEqual([
      ["2026-01-01", 6.5],
      ["2026-02-01", 5.0],
    ]);
  });
});

describe("quarterlyAverage", () => {
  it("dates quarters at the quarter-start month and averages available months", () => {
    // Q4 with October missing (the 2025-10 release gap) averages 2 months.
    const monthly: Observation[] = [
      ["2025-07-01", 4.0],
      ["2025-08-01", 4.2],
      ["2025-09-01", 4.4],
      ["2025-11-01", 4.6],
      ["2025-12-01", 4.8],
    ];
    const quarters = quarterlyAverage(monthly);
    expect(quarters.map(([date]) => date)).toEqual(["2025-07-01", "2025-10-01"]);
    expect(quarters[0][1]).toBeCloseTo(4.2, 10);
    expect(quarters[1][1]).toBeCloseTo(4.7, 10);
  });
});

describe("changeOverMonths / percentChangeOverMonths", () => {
  // A series with 2025-10 missing: index-based lags would mis-pair months
  // here, which is exactly why these helpers are calendar-keyed.
  const gappy: Observation[] = [
    ["2024-09-01", 100],
    ["2024-10-01", 100],
    ["2024-11-01", 100],
    ["2025-09-01", 103],
    ["2025-11-01", 110],
  ];

  it("differences against the observation exactly n months back", () => {
    expect(changeOverMonths(gappy, 12)).toEqual([
      ["2025-09-01", 3],
      ["2025-11-01", 10],
    ]);
  });

  it("drops windows whose base month is missing", () => {
    // 2025-11 minus 1 month would need 2025-10, which is absent.
    expect(changeOverMonths(gappy, 1)).toEqual([
      ["2024-10-01", 0],
      ["2024-11-01", 0],
    ]);
  });

  it("computes percent changes on the same calendar-keyed windows", () => {
    const changes = percentChangeOverMonths(gappy, 12);
    expect(changes.map(([date]) => date)).toEqual(["2025-09-01", "2025-11-01"]);
    expect(changes[0][1]).toBeCloseTo(3, 10);
    expect(changes[1][1]).toBeCloseTo(10, 10);
  });
});

describe("laggedPairs", () => {
  it("matches the outcome with the driver observed lagMonths earlier", () => {
    const driver: Observation[] = [
      ["2025-01-01", 1],
      ["2025-02-01", 2],
    ];
    const outcome: Observation[] = [
      ["2025-07-01", 10],
      ["2025-08-01", 20],
      ["2025-09-01", 30], // no driver at 2025-03 → dropped
    ];
    expect(laggedPairs(driver, outcome, 6)).toEqual([
      { date: "2025-07-01", x: 1, y: 10 },
      { date: "2025-08-01", x: 2, y: 20 },
    ]);
  });
});

describe("cumulativeRealIndex", () => {
  it("is 100 at the base date and deflates nominal growth by inflation", () => {
    const nominal: Observation[] = [
      ["2025-01-01", 20],
      ["2025-02-01", 22], // +10% nominal
    ];
    const prices: Observation[] = [
      ["2025-01-01", 100],
      ["2025-02-01", 110], // +10% prices → real unchanged
    ];
    const index = cumulativeRealIndex(nominal, prices);
    expect(index[0]).toEqual(["2025-01-01", 100]);
    expect(index[1][1]).toBeCloseTo(100, 10);
  });
});
