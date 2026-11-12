import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, Loading, QueryError } from "@/components/states";
import { supabase } from "@/integrations/supabase/client";
import { bodyWeightQuery, gym, profileQuery, useInvalidateGym } from "@/features/gym/data";
import { toISO } from "@/features/gym/dates";
import { parseProfileForm } from "@/features/gym/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/profile")({
  head: () => ({ meta: [{ title: "Profile — Lifeplan" }] }),
  component: ProfilePage,
});

const GOALS = ["Wider shoulders", "Stronger back", "Bigger arms", "Legs", "General fitness"];

function ProfileForm() {
  const { data: profile, isLoading, isError, refetch } = useQuery(profileQuery);
  const invalidate = useInvalidateGym();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("");
  const [perWeek, setPerWeek] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setHeight(profile.height_cm?.toString() ?? "");
    setWeight(profile.weight_kg?.toString() ?? "");
    setGoal(profile.goal ?? "");
    setPerWeek(profile.sessions_per_week?.toString() ?? "");
  }, [profile]);

  if (isLoading) return <Loading rows={1} className="h-64" />;
  if (isError) return <QueryError onRetry={() => refetch()} />;

  async function save() {
    const parsed = parseProfileForm({ height, weight, perWeek });
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    setBusy(true);
    try {
      await gym.saveProfile({ ...parsed.value, goal: goal || null });
      await invalidate();
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 tile p-4 sm:p-5" aria-label="Profile">
      <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
        <label className="space-y-1">
          Height (cm)
          <Input className="h-11" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label className="space-y-1">
          Weight (kg)
          <Input className="h-11" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="space-y-1">
          Sessions / week
          <Input className="h-11" inputMode="numeric" value={perWeek} onChange={(e) => setPerWeek(e.target.value)} />
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground" id="goal-label">
          Goal
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="goal-label">
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={goal === g}
              onClick={() => setGoal(g)}
              className={cn(
                "h-11 rounded-full border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                goal === g ? "border-primary-ink bg-accent font-semibold text-accent-foreground" : "border-input bg-card text-muted-foreground",
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <Button className="h-12 w-full sm:w-auto sm:px-8" disabled={busy} onClick={save}>
        Save
      </Button>
    </section>
  );
}

function BodyWeight() {
  const { data = [], isLoading, isError, refetch } = useQuery(bodyWeightQuery);
  const { data: profile } = useQuery(profileQuery);
  const invalidate = useInvalidateGym();
  const [date, setDate] = useState(() => toISO(new Date()));
  const [kg, setKg] = useState("");

  async function add() {
    const value = Number(kg.replace(",", "."));
    if (!kg.trim() || !Number.isFinite(value) || value < 20 || value > 400) {
      toast.error("Enter a weight in kg");
      return;
    }
    try {
      await gym.saveBodyWeight(date, value);
      if (!data.some((d) => d.date > date)) await gym.saveProfile({ weight_kg: value });
      await invalidate();
      setKg("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  const points = data.map((d) => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    kg: d.weight_kg,
  }));
  const recent = [...data].reverse().slice(0, 8);

  return (
    <section className="space-y-4" aria-label="Body weight">
      <h2 className="text-lg font-semibold">Body weight</h2>
      <div className="flex flex-wrap items-end gap-2 tile p-4">
        <label className="min-w-36 flex-1 space-y-1 text-xs text-muted-foreground">
          Date
          <Input className="h-11" type="date" value={date} max={toISO(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="w-28 space-y-1 text-xs text-muted-foreground">
          kg
          <Input
            className="h-11"
            inputMode="decimal"
            placeholder={profile?.weight_kg?.toString() ?? ""}
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
        </label>
        <Button className="h-11 px-6" onClick={add}>
          Add
        </Button>
      </div>

      {isLoading ? (
        <Loading rows={1} className="h-56" />
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <Empty>No weigh-ins yet.</Empty>
      ) : (
        <>
          {data.length > 1 && (
            <div className="h-56 tile p-4" role="img" aria-label="Body weight over time">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[(m: number) => Math.floor(m - 1), (m: number) => Math.ceil(m + 1)]} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} />
                  <Line type="monotone" dataKey="kg" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="tile divide-y">
            {recent.map((d) => (
              <li key={d.id} className="flex min-h-12 items-center justify-between gap-2 px-4 text-sm">
                <span className="text-muted-foreground">
                  {new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium">{d.weight_kg} kg</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete weigh-in ${d.date}`}
                    onClick={async () => {
                      try {
                        await gym.deleteBodyWeight(d.id);
                        await invalidate();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not delete");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <h1 className="text-[1.75rem] leading-tight">Profile</h1>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ProfileForm />
        <BodyWeight />
      </div>
      <Button
        variant="outline"
        className="h-12 w-full md:hidden"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
        }}
      >
        <LogOut className="mr-1 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
