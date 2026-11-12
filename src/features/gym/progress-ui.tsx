import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { historyQuery } from "./data";
import { chartPoints, readyToGoUp, sessionsFor, type ExerciseSession } from "./progress";

/** Sessions per exercise id (newest first) for a set of exercises, from one request. */
export function useExerciseSessions(exerciseIds: string[]) {
  const ids = useMemo(() => [...new Set(exerciseIds)], [exerciseIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery(historyQuery(ids));
  const byExercise = useMemo(() => {
    const map = new Map<string, ExerciseSession[]>();
    if (q.data) for (const id of ids) map.set(id, sessionsFor(id, q.data.sets, q.data.logs));
    return map;
  }, [q.data, ids]);
  return { ...q, byExercise };
}

/** Small marker shown when the last two sessions hit the top of the rep range. */
export function ReadyBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
      <ArrowUp className="h-3 w-3" aria-hidden /> Go up
    </span>
  );
}

export function isReady(sessions: ExerciseSession[] | undefined) {
  return !!sessions && readyToGoUp(sessions);
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function ProgressChart({ sessions }: { sessions: ExerciseSession[] }) {
  const data = chartPoints(sessions.slice(0, 20)).map((p) => ({ ...p, label: fmtDate(p.date) }));
  const hasWeight = data.some((d) => d.weight != null);
  return (
    <div className="h-56 w-full" role="img" aria-label="Weight and reps over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          {hasWeight && (
            <YAxis
              yAxisId="w"
              allowDecimals={false}
              domain={[(m: number) => Math.floor(m - 2), (m: number) => Math.ceil(m + 2)]}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
          )}
          <YAxis yAxisId="r" orientation="right" hide />
          <Tooltip />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          {hasWeight && (
            <Line
              yAxisId="w"
              type="monotone"
              dataKey="weight"
              name="kg"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
          )}
          <Line
            yAxisId="r"
            type="monotone"
            dataKey="reps"
            name="reps"
            stroke="var(--muted-foreground)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
