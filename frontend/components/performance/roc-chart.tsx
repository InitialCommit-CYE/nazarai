"use client";

import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";

import type { MetricsComplete } from "@/lib/types";

// Validated with the dataviz palette validator (light surface): all checks pass, tritan dE 11.6.
export const SERIES_COLORS = { validation: "#009e8f", external_test: "#2f5fd0" } as const;
const INK = "oklch(0.3 0.02 235)";

export function RocChart({ metrics }: { metrics: MetricsComplete }) {
  const splits = (["validation", "external_test"] as const).flatMap((k) => {
    const s = metrics.splits[k];
    return s?.roc ? [{ key: k, s }] : [];
  });
  const bench = [{ fpr: 1 - metrics.benchmark.specificity, tpr: metrics.benchmark.sensitivity }];

  return (
    <div className="h-80 w-full" role="img" aria-label="ROC curves for referable DR with operating points and the IDx-DR reference point. Values are listed in the table below.">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 8, right: 16, bottom: 28, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeWidth={1} />
          <XAxis
            type="number"
            dataKey="fpr"
            domain={[0, 1]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            label={{ value: "1 − specificity (false-positive rate)", position: "insideBottom", offset: -16, fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            type="number"
            dataKey="tpr"
            domain={[0, 1]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            width={36}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))}
            labelFormatter={(v) => `FPR ${Number(v).toFixed(3)}`}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }}
          />
          <Legend verticalAlign="top" height={30} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line
            data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]}
            dataKey="tpr"
            stroke="var(--border)"
            strokeWidth={1}
            dot={false}
            activeDot={false}
            legendType="none"
            name="Chance"
            isAnimationActive={false}
          />
          {splits.map(({ key, s }) => (
            <Line
              key={key}
              data={s.roc!.fpr.map((f, i) => ({ fpr: f, tpr: s.roc!.tpr[i] }))}
              dataKey="tpr"
              name={`${s.name} (AUC ${s.referable.auc?.toFixed(3) ?? "–"})`}
              stroke={SERIES_COLORS[key]}
              strokeWidth={2}
              dot={false}
              type="linear"
              isAnimationActive={false}
            />
          ))}
          {splits.map(({ key, s }) =>
            s.roc!.operating_point.fpr != null ? (
              <Scatter
                key={`${key}-op`}
                data={[{ fpr: s.roc!.operating_point.fpr, tpr: s.roc!.operating_point.tpr }]}
                dataKey="tpr"
                name={`${s.name}: deployed threshold`}
                fill={SERIES_COLORS[key]}
                stroke="var(--card)"
                strokeWidth={2}
                shape="circle"
                legendType="none"
              />
            ) : null,
          )}
          <Scatter data={bench} dataKey="tpr" name="IDx-DR (reported)" fill={INK} shape="cross" legendType="cross" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
