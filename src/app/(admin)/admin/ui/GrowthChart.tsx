"use client";

import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

function buildSeries(createdAtList: Date[], months = 12) {
  const now = new Date();
  const start = startOfMonth(subMonths(now, months - 1));
  const buckets = new Map<string, number>();

  for (let i = 0; i < months; i++) {
    const d = startOfMonth(subMonths(now, months - 1 - i));
    buckets.set(format(d, "yyyy-MM"), 0);
  }

  createdAtList.forEach((d) => {
    const key = format(d, "yyyy-MM");
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  const rows = Array.from(buckets.entries()).map(([key, count]) => {
    const [year, month] = key.split("-").map((v) => Number(v));
    const dt = new Date(year, (month ?? 1) - 1, 1);
    return { key, label: format(dt, "MMM/yy"), count };
  });

  return { rows, start, end: endOfMonth(now) };
}

export function GrowthChart(props: { createdAtList: Date[] }) {
  const { rows } = buildSeries(props.createdAtList, 12);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="currentColor" stopOpacity={0.22} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12 }}
        />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={30} />
        <Tooltip
          contentStyle={{
            background: "rgba(15, 23, 42, 0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            color: "white",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.75)" }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="currentColor"
          fill="url(#fill)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
