import { createFileRoute } from "@tanstack/react-router";
import { ItemsPage } from "@/features/pantry/ItemsPage";

export const Route = createFileRoute("/_authenticated/_shell/pantry/")({
  component: ItemsPage,
});
