import { createFileRoute } from "@tanstack/react-router";
import { KitchenPage } from "@/features/pantry/KitchenPage";

export const Route = createFileRoute("/_authenticated/_shell/pantry/kitchen")({
  component: KitchenPage,
});
