"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Observation } from "@/lib/types";

/**
 * The one time-series chart component. It enforces the chart contract from
 * the PRD: title, subtitle, unit, period, source line, accessible
 * description, tooltips, and legends — a chart cannot render without them.
 *
 * Client component: props must be serializable. Pages (server components)
 * compute series with lib/econ and pass plain arrays.
 */

export interface ChartSeries {
  name: string;
  data: Observation[];
  /** Design-token chart color slot. */
  color?: "1" | "2" | "3" | "4";
  dashed?: boolean;
}

export interface TimeSeriesChartProps {
  title: string;
  subtitle: string;
  unit: string;
  sourceLine: string;
  /** Plain-language summary for screen readers — required. */
  description: string;
  series: ChartSeries[];
  valueDecimals?: number;
  /** Draw a zero reference line (growth-rate charts). */
  zeroLine?: boolean;
  height?: number;
}

const COLOR_VARS: Record<string, string> = {
  "1": "var(--chart-1)",
  "2": "var(--chart-2)",
  "3": "var(--chart-3)",
  "4": "var(--chart-4)",
};

/** Merge multiple [date, value] series into Recharts row objects by date. */
function toRows(
  series: ChartSeries[],
): Array<Record<string, number | string | null>> {
  const rowMap = new Map<string, Record<string, number | string | null>>();
  for (const s of series) {
    for (const [date, value] of s.data) {
      const row = rowMap.get(date) ?? { date };
      row[s.name] = value;
      rowMap.set(date, row);
    }
  }
  return [...rowMap.values()].sort((a, b) =>
    String(a.date) < String(b.date) ? -1 : 1,
  );
}

/** "'26" or "2026" tick labels depending on span. */
function makeTickFormatter(spanYears: number) {
  return (isoDate: string) => {
    const year = isoDate.slice(0, 4);
    if (spanYears > 12) return year;
    const month = Number(isoDate.slice(5, 7));
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${names[month - 1]} ${year.slice(2)}`;
  };
}

function formatTooltipDate(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(month) - 1]} ${year}`;
}

export function TimeSeriesChart({
  title,
  subtitle,
  unit,
  sourceLine,
  description,
  series,
  valueDecimals = 1,
  zeroLine = false,
  height = 300,
}: TimeSeriesChartProps) {
  const rows = toRows(series);
  const firstDate = String(rows[0]?.date ?? "");
  const lastDate = String(rows[rows.length - 1]?.date ?? "");
  const spanYears =
    Number(lastDate.slice(0, 4)) - Number(firstDate.slice(0, 4)) || 1;

  return (
    <figure className="rounded-lg border border-hairline bg-surface p-5">
      <figcaption>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {subtitle} · {unit}
        </p>
      </figcaption>

      {/* Legend — only when the chart has more than one series. */}
      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5 text-xs text-ink-secondary">
              <span
                className="inline-block h-0.5 w-4 rounded"
                style={{
                  background: COLOR_VARS[s.color ?? "1"],
                  ...(s.dashed
                    ? {
                        backgroundImage: `repeating-linear-gradient(90deg, ${COLOR_VARS[s.color ?? "1"]} 0 4px, transparent 4px 7px)`,
                        background: "none",
                        borderTop: `2px dashed ${COLOR_VARS[s.color ?? "1"]}`,
                        height: 0,
                      }
                    : {}),
                }}
              />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3" style={{ height }} role="img" aria-label={description}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={makeTickFormatter(spanYears)}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--hairline-strong)" }}
              minTickGap={48}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => v.toLocaleString("en-US")}
            />
            {zeroLine && (
              <ReferenceLine y={0} stroke="var(--hairline-strong)" strokeWidth={1.5} />
            )}
            <Tooltip
              cursor={{ stroke: "var(--hairline-strong)" }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--ink)",
              }}
              labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
              labelFormatter={(label) => formatTooltipDate(String(label))}
              formatter={(value) => [
                typeof value === "number"
                  ? `${value.toLocaleString("en-US", {
                      minimumFractionDigits: valueDecimals,
                      maximumFractionDigits: valueDecimals,
                    })} ${unit}`
                  : String(value),
              ]}
            />
            {series.map((s) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={COLOR_VARS[s.color ?? "1"]}
                strokeWidth={1.8}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 border-t border-hairline pt-2 text-xs text-muted">
        {sourceLine} · {formatTooltipDate(firstDate)}–{formatTooltipDate(lastDate)}
      </p>
    </figure>
  );
}
