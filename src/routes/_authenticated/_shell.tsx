import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Dumbbell, Languages, LogOut, ShoppingBasket, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/features/gym/data";
import { ChatPanel } from "@/components/ChatPanel";

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

  useEffect(() => {
    if (isSuccess && !profile?.onboarded) navigate({ to: "/onboarding" });
  }, [isSuccess, profile, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="h-3 w-3 rounded-full bg-primary" />
          <span className="font-semibold">Lifeplan</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-secondary"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
            >
              <Icon className="h-5 w-5" /> {label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="mt-auto flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-secondary">
          <LogOut className="h-5 w-5" /> Sign out
        </button>
      </aside>

      <main className="min-w-0 flex-1 pb-28 md:pb-10">
        <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-8 sm:pt-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="h-5 w-5" /> {label}
          </Link>
        ))}
      </nav>

      <ChatPanel />
    </div>
  );
}
