/**
 * Formatting helpers — the only place display formatting logic lives, so
 * number and date presentation stays consistent across every page.
 */

/** "3.4%" style with fixed decimals; sign shown only when `signed`. */
export function formatPercent(value: number, decimals = 1, signed = false): string {
  if (!Number.isFinite(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/** Plain number with thousands separators and fixed decimals. */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Signed number, e.g. "+147" for payroll changes. */
export function formatSigned(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, decimals)}`;
}

/** Currency without cents by default: "$412,300". */
export function formatDollars(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Compact large values: "$18.4T", "1.4M". */
export function formatCompact(value: number, prefix = ""): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${prefix}${abs.toFixed(0)}`;
}

/** "Jun 2026" from an ISO date — the standard observation-date format. */
export function formatMonth(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[(month ?? 1) - 1]} ${year}`;
}

/** "Q1 2026" for quarterly observations (dated at quarter start). */
export function formatQuarter(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return `Q${Math.floor(((month ?? 1) - 1) / 3) + 1} ${year}`;
}

/** "Jul 17, 2026" for daily/weekly observations. */
export function formatFullDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[(month ?? 1) - 1]} ${day}, ${year}`;
}

/** Frequency-appropriate observation date label. */
export function formatObservationDate(
  isoDate: string,
  frequency: "D" | "W" | "M" | "Q" | "A",
): string {
  if (frequency === "Q") return formatQuarter(isoDate);
  if (frequency === "M") return formatMonth(isoDate);
  if (frequency === "A") return isoDate.slice(0, 4);
  return formatFullDate(isoDate);
}
