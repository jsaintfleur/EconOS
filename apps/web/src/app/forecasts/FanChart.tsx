"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Fan chart: recent history, point forecast, and empirical 50%/80% interval
 * bands. Bands come straight from backtest error quantiles (see
 * docs/forecasting-methodology.md) — uncertainty is data, not decoration.
 */

export interface FanChartProps {
  title: string;
  subtitle: string;
  unit: string;
  sourceLine: string;
  description: string;
  history: Array<[string, number]>;
  forecast: Array<{
    date: string;
    value: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
  }>;
  valueDecimals?: number;
  zeroLine?: boolean;
  height?: number;
}

interface Row {
  date: string;
  history?: number;
  forecast?: number;
  /** Recharts range areas take [low, high] tuples. */
  band80?: [number, number];
  band50?: [number, number];
}

function formatMonthLabel(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(month) - 1]} ${year}`;
}

export function FanChart({
  title,
  subtitle,
  unit,
  sourceLine,
  description,
  history,
  forecast,
  valueDecimals = 1,
  zeroLine = false,
  height = 320,
}: FanChartProps) {
  const rows: Row[] = history.map(([date, value]) => ({ date, history: value }));

  // Bridge the visual gap: the forecast line starts from the last actual.
  const lastActual = history[history.length - 1];
  if (lastActual) {
    rows[rows.length - 1] = {
      ...rows[rows.length - 1],
      forecast: lastActual[1],
      band80: [lastActual[1], lastActual[1]],
      band50: [lastActual[1], lastActual[1]],
    };
  }
  for (const point of forecast) {
    rows.push({
      date: point.date,
      forecast: point.value,
      band80: [point.p10, point.p90],
      band50: [point.p25, point.p75],
    });
  }

  const forecastStart = lastActual?.[0];

  return (
    <figure className="rounded-lg border border-hairline bg-surface p-5">
      <figcaption>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {subtitle} · {unit}
        </p>
      </figcaption>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-chart-1" /> History
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block w-4"
            style={{ borderTop: "2px dashed var(--chart-1)" }}
          />{" "}
          Forecast
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "var(--chart-1)", opacity: 0.28 }} />
          50% interval
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "var(--chart-1)", opacity: 0.14 }} />
          80% interval
        </li>
      </ul>

      <div className="mt-3" style={{ height }} role="img" aria-label={description}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => {
                const [year, month] = d.split("-");
                return month === "01" ? year : `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(month)-1]} ${year.slice(2)}`;
              }}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--hairline-strong)" }}
              minTickGap={56}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => v.toLocaleString("en-US")}
            />
            {zeroLine && (
              <ReferenceLine y={0} stroke="var(--hairline-strong)" strokeWidth={1.5} />
            )}
            {forecastStart && (
              <ReferenceLine
                x={forecastStart}
                stroke="var(--hairline-strong)"
                strokeDasharray="3 3"
                label={{
                  value: "forecast →",
                  position: "insideTopRight",
                  fill: "var(--muted)",
                  fontSize: 11,
                }}
              />
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
              labelFormatter={(label) => formatMonthLabel(String(label))}
              formatter={(value, name) => {
                if (Array.isArray(value)) {
                  const [lo, hi] = value as [number, number];
                  return [
                    `${lo.toFixed(valueDecimals)} to ${hi.toFixed(valueDecimals)} ${unit}`,
                    name === "band80" ? "80% interval" : "50% interval",
                  ];
                }
                return [
                  `${Number(value).toFixed(valueDecimals)} ${unit}`,
                  name === "history" ? "Actual" : "Point forecast",
                ];
              }}
            />
            <Area
              dataKey="band80"
              stroke="none"
              fill="var(--chart-1)"
              fillOpacity={0.14}
              isAnimationActive={false}
              connectNulls
            />
            <Area
              dataKey="band50"
              stroke="none"
              fill="var(--chart-1)"
              fillOpacity={0.28}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              dataKey="history"
              stroke="var(--chart-1)"
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="forecast"
              stroke="var(--chart-1)"
              strokeWidth={1.8}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 border-t border-hairline pt-2 text-xs text-muted">{sourceLine}</p>
    </figure>
  );
}
