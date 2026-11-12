import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyTarget } from "@/features/pantry/sheets";

/** Old address from before the single kitchen screen. */
export const Route = createFileRoute("/_authenticated/_shell/pantry/cook")({
  beforeLoad: () => {
    throw redirect({ to: "/pantry", search: legacyTarget("cook"), replace: true });
  },
});
