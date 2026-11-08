import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/_authenticated/_shell/pantry")({
  head: () => ({ meta: [{ title: "Pantry — Lifeplan" }] }),
  component: () => <ComingSoon title="Pantry" />,
});
