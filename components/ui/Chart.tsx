"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtClock } from "@/lib/format";

interface Point {
  at: string;
  value: number;
  baseline?: number;
}

export function TrendChart({
  data,
  color = "#22d3ee",
  unit = "",
  height = 220,
  label = "value",
}: {
  data: Point[];
  color?: string;
  unit?: string;
  height?: number;
  label?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="at"
          tickFormatter={(v) => fmtClock(v)}
          tick={{ fill: "#67707f", fontSize: 10 }}
          stroke="rgba(255,255,255,0.1)"
          minTickGap={40}
        />
        <YAxis tick={{ fill: "#67707f", fontSize: 10 }} stroke="rgba(255,255,255,0.1)" width={44} />
        <Tooltip
          contentStyle={{
            background: "#10131a",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            fontSize: 12,
          }}
          labelFormatter={(v) => fmtClock(v as string)}
          formatter={((val: unknown, name: unknown) => [
            `${Math.round(Number(val))}${unit}`,
            name === "value" ? label : "baseline",
          ]) as never}
        />
        {data.some((d) => d.baseline != null) && (
          <Line
            type="monotone"
            dataKey="baseline"
            stroke="rgba(255,255,255,0.3)"
            strokeDasharray="4 4"
            strokeWidth={1}
            dot={false}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#g-${color})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
