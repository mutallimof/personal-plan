import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Dumbbell, Languages, LogOut, ShoppingBasket, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { planQuery, profileQuery, type Session } from "@/features/gym/data";
import { clearPlanCache, readPlanCache, writePlanCache } from "@/lib/plan-cache";
import { ChatPanel } from "@/components/ChatPanel";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/_shell")({
  component: Shell,
});

const NAV = [
  { to: "/gym", label: "Gym", icon: Dumbbell },
  { to: "/languages", label: "Languages", icon: Languages },
  { to: "/pantry", label: "Pantry", icon: ShoppingBasket },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function Shell() {
  const navigate = useNavigate();
  const { data: profile, isSuccess } = useQuery(profileQuery);
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();

  // Offline copy of the plan: restore the last one right away, keep it up to date after every load.
  useEffect(() => {
    try {
      if (!qc.getQueryData(planQuery.queryKey)) {
        const cached = readPlanCache(localStorage, user.id);
        if (cached) qc.setQueryData(planQuery.queryKey, cached as Session[]);
      }
    } catch {
      /* storage blocked */
    }
    return qc.getQueryCache().subscribe((e) => {
      const q = e.query;
      if (e.type === "updated" && q.queryKey.join("/") === planQuery.queryKey.join("/") && q.state.status === "success") {
        try {
          writePlanCache(localStorage, user.id, q.state.data);
        } catch {
          /* storage blocked */
        }
      }
    });
  }, [qc, user.id]);

  useEffect(() => {
    if (isSuccess && !profile?.onboarded) navigate({ to: "/onboarding" });
  }, [isSuccess, profile, navigate]);

  async function signOut() {
    try {
      clearPlanCache(localStorage);
    } catch {
      /* storage blocked */
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <Logo className="mb-8 px-2 pt-2" />
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex h-12 items-center gap-3 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              activeProps={{ className: "bg-accent text-accent-foreground hover:bg-accent" }}
            >
              <Icon className="h-5 w-5" /> {label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="mt-auto flex h-12 items-center gap-3 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <LogOut className="h-5 w-5" /> Sign out
        </button>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(var(--dock)+2.5rem+env(safe-area-inset-bottom))] md:pb-10">
        <div className="mx-auto max-w-5xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8 sm:pt-[calc(2rem+env(safe-area-inset-top))]">
          <Outlet />
        </div>
      </main>

      {/* The dock: floats over the page, one thumb reaches all four. */}
      <nav aria-label="Main" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto grid h-16 max-w-md grid-cols-4 rounded-full border bg-card/95 px-1.5 shadow-pop backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            activeProps={{ className: "font-semibold text-foreground" }}
          >
            <span className="flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200 ease-out-soft group-active:scale-95 group-aria-[current=page]:bg-primary group-aria-[current=page]:text-primary-foreground">
              <Icon className="h-5 w-5 group-aria-[current=page]:stroke-[2.4]" />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      <ChatPanel />
    </div>
  );
}
