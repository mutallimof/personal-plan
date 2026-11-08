import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/_authenticated/_shell/languages")({
  head: () => ({ meta: [{ title: "Languages — Lifeplan" }] }),
  component: () => <ComingSoon title="Languages" />,
});
