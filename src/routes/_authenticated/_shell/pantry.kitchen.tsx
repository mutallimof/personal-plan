import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyTarget } from "@/features/pantry/sheets";

/** Old address from before the single kitchen screen. */
export const Route = createFileRoute("/_authenticated/_shell/pantry/kitchen")({
  beforeLoad: () => {
    throw redirect({ to: "/pantry", search: legacyTarget("kitchen"), replace: true });
  },
});
