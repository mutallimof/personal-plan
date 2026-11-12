import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Splash } from "@/components/Splash";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession reads the stored session (no network), so the app also opens offline.
    // Data access is still enforced by row-level security on the server.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  pendingComponent: Splash,
  component: () => <Outlet />,
});
