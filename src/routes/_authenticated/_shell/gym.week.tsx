import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/_authenticated/_shell/gym/week")({
  head: () => ({ meta: [{ title: "Week — Lifeplan" }] }),
  component: () => <ComingSoon title="Week" />,
});
