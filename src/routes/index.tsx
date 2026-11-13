import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lifeplan — your personal life planner" },
      { name: "description", content: "Plan your gym sessions, week and month. Edit by hand or just tell the chat." },
      { property: "og:title", content: "Lifeplan — your personal life planner" },
      { property: "og:description", content: "Plan your gym sessions, week and month. Edit by hand or just tell the chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/gym" });
    });
  }, [navigate]);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
      {/* a low sun behind the sprout */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-22rem] h-[44rem] w-[44rem] -translate-x-1/2 rounded-full bg-primary-soft/45" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-12rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary-soft/70" />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <LogoMark animated className="h-24 w-24 rounded-[27%] shadow-float" />
        <h1 className="animate-rise text-6xl font-extrabold leading-none [animation-delay:300ms]">Lifeplan</h1>
        <p className="max-w-[17rem] animate-rise text-balance text-lg leading-snug text-muted-foreground [animation-delay:420ms]">Training, kitchen and meals in one plan.</p>
      </div>

      <div className="relative mx-auto w-full max-w-sm animate-rise [animation-delay:540ms]">
        <Button asChild size="lg" className="w-full">
          <Link to="/auth">Get started</Link>
        </Button>
      </div>
    </main>
  );
}
