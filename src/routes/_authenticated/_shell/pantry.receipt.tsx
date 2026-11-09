import { createFileRoute } from "@tanstack/react-router";
import { ReceiptPage } from "@/features/pantry/ReceiptPage";

export const Route = createFileRoute("/_authenticated/_shell/pantry/receipt")({
  component: ReceiptPage,
});
