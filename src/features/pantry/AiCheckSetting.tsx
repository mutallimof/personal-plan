import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { pantry, settingsQuery, useInvalidatePantry } from "./data";

/** Switch for the optional AI check of unknown receipt lines, with the count of lines sent so far. */
export function AiCheckSetting() {
  const settings = useQuery(settingsQuery);
  const invalidate = useInvalidatePantry();

  async function onToggle(on: boolean) {
    try {
      await pantry.setAiCheck(on);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="tile px-4 py-2 text-sm">
      <label className="flex min-h-11 items-center justify-between">
        AI check for unknown lines
        <Switch checked={settings.data?.aiCheck ?? false} onCheckedChange={onToggle} disabled={!settings.data} aria-label="AI check for unknown lines" />
      </label>
      {(settings.data?.aiCheck || (settings.data?.aiLinesSent ?? 0) > 0) && (
        <p className="pb-2 text-xs text-muted-foreground">{settings.data?.aiLinesSent ?? 0} lines sent so far</p>
      )}
    </div>
  );
}
