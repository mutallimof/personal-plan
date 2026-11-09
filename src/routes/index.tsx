import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-primary" />
        <span className="text-lg font-semibold tracking-tight">Lifeplan</span>
      </div>
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">Your training, planned.</h1>
      <p className="max-w-md text-muted-foreground">Sessions, weights and schedule — change anything by tapping or by asking.</p>
      <Button asChild size="lg" className="h-12 rounded-full px-8">
        <Link to="/auth">Get started</Link>
      </Button>
    </main>
  );
}
