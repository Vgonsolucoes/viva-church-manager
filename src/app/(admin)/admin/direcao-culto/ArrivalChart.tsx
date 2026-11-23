"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

export function ArrivalChart({
  arrived,
  waiting,
  absent,
  ministries,
}: {
  arrived: number;
  waiting: number;
  absent: number;
  ministries: {
    name: string;
    arrived: number;
    waiting: number;
    absent: number;
  }[];
}) {
  const data = [
    { name: "Chegaram", value: arrived, color: "#458568" },
    { name: "Aguardando", value: waiting, color: "#C59145" },
    { name: "Falta a conferir", value: absent, color: "#B55149" },
  ];
  if (!arrived && !waiting && !absent)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Inclua os voluntários na escala deste culto para acompanhar as chegadas.
      </p>
    );
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div>
        <div
          className="h-64"
          role="img"
          aria-label={`${arrived} chegaram, ${waiting} aguardando e ${absent} faltas a conferir`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.filter((item) => item.value)}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="85%"
                paddingAngle={3}
              >
                {data
                  .filter((item) => item.value)
                  .map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-wrap justify-center gap-4 text-sm">
          {data.map((item) => (
            <li key={item.name} className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name} <strong>{item.value}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div
        style={{ height: Math.max(260, ministries.length * 45) }}
        aria-label="Chegadas por ministério"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={ministries}
            layout="vertical"
            margin={{ left: 8, right: 15 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="var(--border)"
            />
            <XAxis type="number" allowDecimals={false} fontSize={11} />
            <YAxis dataKey="name" type="category" width={115} fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                borderColor: "var(--border)",
                borderRadius: 12,
              }}
            />
            <Legend />
            <Bar
              name="Chegaram"
              dataKey="arrived"
              stackId="team"
              fill="#458568"
            />
            <Bar
              name="Aguardando"
              dataKey="waiting"
              stackId="team"
              fill="#C59145"
            />
            <Bar
              name="Falta a conferir"
              dataKey="absent"
              stackId="team"
              fill="#B55149"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
