import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { gym } from "@/features/gym/data";
import { generatePlan } from "@/features/gym/ai.functions";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/onboarding")({
  // Already set up? Skip straight to the app. New users (no profile or onboarded = false) stay here.
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("profiles").select("onboarded").eq("id", context.user.id).maybeSingle();
    if (data?.onboarded) throw redirect({ to: "/gym" });
  },
  head: () => ({ meta: [{ title: "Get started — Lifeplan" }] }),
  component: Onboarding,
});

const GOALS = ["Wider shoulders", "Stronger back", "Bigger arms", "Legs", "General fitness"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

function Chips({ options, value, onChange }: { options: (string | number)[]; value: string | number; onChange: (v: never) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          onClick={() => onChange(o as never)}
          aria-pressed={value === o}
          className={cn("press h-11 rounded-full border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value === o ? "border-primary-ink bg-accent font-semibold text-accent-foreground" : "border-input bg-card")}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const gen = useServerFn(generatePlan);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState<string>(GOALS[0] ?? "");
  const [perWeek, setPerWeek] = useState<number>(4);
  const [custom, setCustom] = useState("");
  const [level, setLevel] = useState<string>(LEVELS[1] ?? "");
  const [busy, setBusy] = useState<null | "ai" | "example">(null);

  const sessions = perWeek === 0 ? Number(custom) || 6 : perWeek;

  async function save(onboarded: boolean) {
    await gym.saveProfile({
      height_cm: height ? Number(height) : null,
      weight_kg: weight ? Number(weight) : null,
      goal,
      sessions_per_week: sessions,
      experience: level,
      onboarded,
    });
  }

  async function run(kind: "ai" | "example") {
    setBusy(kind);
    try {
      if (kind === "ai") {
        await save(false);
        await gen();
      } else {
        await save(true);
        await gym.seedExample();
      }
      await qc.invalidateQueries({ queryKey: ["gym"] });
      navigate({ to: "/gym" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
    setBusy(null);
  }

  return (
    <main className="mx-auto max-w-lg space-y-8 px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <Logo />
      <h1 className="text-4xl leading-none">Let's set up your plan</h1>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5 text-sm font-medium">
          Height (cm)
          <Input className="h-12" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="180" />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Weight (kg)
          <Input className="h-12" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="75" />
        </label>
      </div>
      <section className="space-y-2">
        <p className="text-sm font-medium">Goal</p>
        <Chips options={GOALS} value={goal} onChange={setGoal} />
      </section>
      <section className="space-y-2">
        <p className="text-sm font-medium">Sessions per week</p>
        <div className="flex flex-wrap items-center gap-2">
          <Chips options={[3, 4, 5]} value={perWeek} onChange={setPerWeek} />
          <button type="button" onClick={() => setPerWeek(0)} aria-pressed={perWeek === 0} className={cn("press h-11 rounded-full border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", perWeek === 0 ? "border-primary-ink bg-accent font-semibold text-accent-foreground" : "border-input bg-card")}>
            More
          </button>
          {perWeek === 0 && <Input className="h-11 w-20" aria-label="Sessions per week" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="6" />}
        </div>
      </section>
      <section className="space-y-2">
        <p className="text-sm font-medium">Experience</p>
        <Chips options={LEVELS} value={level} onChange={setLevel} />
      </section>

      <div className="space-y-3">
        <Button size="lg" className="w-full" disabled={!!busy} onClick={() => run("ai")}>
          {busy === "ai" ? "Building your plan…" : "Generate my plan"}
        </Button>
        <Button variant="outline" size="lg" className="w-full" disabled={!!busy} onClick={() => run("example")}>
          {busy === "example" ? "Loading…" : "Use the example plan"}
        </Button>
      </div>
    </main>
  );
}
