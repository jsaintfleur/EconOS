"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

/**
 * The one scatter chart for the research modules. It follows the same chart
 * contract as components/charts/TimeSeriesChart: title, subtitle, labeled
 * units on both axes, source line, accessible description, and tooltips —
 * a chart cannot render without them.
 *
 * Client component: props must be serializable. Server pages compute the
 * points (and any OLS fit endpoints) with lib/econ and pass plain objects.
 * Fit lines are drawn as two-point Scatter series with the connecting-line
 * option and invisible markers, so scatter and fit share one axis system.
 */

/** One plotted observation; `label` is a preformatted period, e.g. "Q3 2009". */
export interface ScatterPoint {
  x: number;
  y: number;
  label: string;
}

/** A group of points sharing a color — e.g. a period regime. */
export interface ScatterGroup {
  name: string;
  /** Design-token chart color slot. */
  color?: "1" | "2" | "3" | "4";
  points: ScatterPoint[];
}

/** A straight fit line, passed as its two endpoints (computed server-side). */
export interface ScatterFitLine {
  name: string;
  color?: "1" | "2" | "3" | "4";
  dashed?: boolean;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface ScatterChartProps {
  title: string;
  subtitle: string;
  /** Axis captions including units, e.g. "Real GDP growth (% SAAR)". */
  xLabel: string;
  yLabel: string;
  /** Short units appended to tooltip values, e.g. "%" or "pp". */
  xUnit: string;
  yUnit: string;
  sourceLine: string;
  /** Plain-language summary for screen readers — required. */
  description: string;
  groups: ScatterGroup[];
  fitLines?: ScatterFitLine[];
  xDecimals?: number;
  yDecimals?: number;
  height?: number;
}

const COLOR_VARS: Record<string, string> = {
  "1": "var(--chart-1)",
  "2": "var(--chart-2)",
  "3": "var(--chart-3)",
  "4": "var(--chart-4)",
};

/** Internal point shape carried through recharts to the tooltip. */
interface TooltipPoint extends ScatterPoint {
  group: string;
}

/** Invisible marker for fit-line scatters — only the connecting line shows. */
function NoMarker() {
  return <g />;
}

export function ScatterChart({
  title,
  subtitle,
  xLabel,
  yLabel,
  xUnit,
  yUnit,
  sourceLine,
  description,
  groups,
  fitLines = [],
  xDecimals = 1,
  yDecimals = 1,
  height = 340,
}: ScatterChartProps) {
  const format = (value: number, decimals: number, unit: string) =>
    `${value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${unit ? ` ${unit}` : ""}`;

  /** Tooltip: period label, group, then both coordinates with units. */
  const renderTooltip = (props: TooltipContentProps) => {
    const point = props.payload?.[0]?.payload as TooltipPoint | undefined;
    if (!props.active || !point) return null;
    return (
      <div className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs text-ink">
        <p className="text-muted">
          {point.label} · {point.group}
        </p>
        <p className="tabular mt-1">
          {xLabel}: {format(point.x, xDecimals, xUnit)}
        </p>
        <p className="tabular">
          {yLabel}: {format(point.y, yDecimals, yUnit)}
        </p>
      </div>
    );
  };

  return (
    <figure className="rounded-lg border border-hairline bg-surface p-5">
      <figcaption>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      </figcaption>

      {/* Legend: dots for point groups, line swatches for fits. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
        {groups.map((group) => (
          <li
            key={group.name}
            className="flex items-center gap-1.5 text-xs text-ink-secondary"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: COLOR_VARS[group.color ?? "1"] }}
            />
            {group.name}
          </li>
        ))}
        {fitLines.map((line) => (
          <li
            key={line.name}
            className="flex items-center gap-1.5 text-xs text-ink-secondary"
          >
            <span
              className="inline-block w-4"
              style={{
                borderTop: `2px ${line.dashed ? "dashed" : "solid"} ${COLOR_VARS[line.color ?? "1"]}`,
              }}
            />
            {line.name}
          </li>
        ))}
      </ul>

      <div className="mt-3" style={{ height }} role="img" aria-label={description}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" />
            <XAxis
              type="number"
              dataKey="x"
              domain={["auto", "auto"]}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--hairline-strong)" }}
              label={{
                value: xLabel,
                position: "insideBottom",
                offset: -18,
                fill: "var(--muted)",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={["auto", "auto"]}
              width={52}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                offset: 4,
                style: { textAnchor: "middle" },
                fill: "var(--muted)",
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ stroke: "var(--hairline-strong)", strokeDasharray: "3 3" }}
              content={renderTooltip}
            />
            {groups.map((group) => (
              <Scatter
                key={group.name}
                name={group.name}
                data={group.points.map(
                  (point): TooltipPoint => ({ ...point, group: group.name }),
                )}
                fill={COLOR_VARS[group.color ?? "1"]}
                fillOpacity={0.55}
                isAnimationActive={false}
              />
            ))}
            {fitLines.map((line) => (
              <Scatter
                key={line.name}
                name={line.name}
                data={[line.from, line.to]}
                fill="none"
                line={{
                  stroke: COLOR_VARS[line.color ?? "1"],
                  strokeWidth: 1.8,
                  strokeDasharray: line.dashed ? "5 4" : undefined,
                }}
                shape={NoMarker}
                tooltipType="none"
                isAnimationActive={false}
              />
            ))}
          </RechartsScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 border-t border-hairline pt-2 text-xs text-muted">{sourceLine}</p>
    </figure>
  );
}
