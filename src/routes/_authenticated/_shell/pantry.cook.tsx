import { createFileRoute } from "@tanstack/react-router";
import { CookPage } from "@/features/cook/CookPage";

export const Route = createFileRoute("/_authenticated/_shell/pantry/cook")({
  component: CookPage,
});
