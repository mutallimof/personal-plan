import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { settingsQuery, useInvalidatePantry } from "@/features/pantry/data";
import { cook } from "./data";

/** The opt-in for the AI cooking chat: off by default, says what is sent, counts the requests. */
export function AiChatSetting() {
  const settings = useQuery(settingsQuery);
  const invalidate = useInvalidatePantry();

  async function onToggle(on: boolean) {
    try {
      await cook.setAiChat(on);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  const on = settings.data?.aiChat ?? false;
  const count = settings.data?.aiChatRequests ?? 0;
  return (
    <div className="tile px-4 py-2 text-sm">
      <label className="flex min-h-11 items-center justify-between">
        AI cooking chat
        <Switch checked={on} onCheckedChange={onToggle} disabled={!settings.data} aria-label="AI cooking chat" />
      </label>
      <p className="pb-2 text-xs text-muted-foreground">
        Sends your message, your stock (item names, amounts, units) and your recipe titles. Never receipts, photos or dates.
      </p>
      {(on || count > 0) && (
        <p className="pb-2 text-xs text-muted-foreground">
          {count} {count === 1 ? "request" : "requests"} so far
        </p>
      )}
    </div>
  );
}
