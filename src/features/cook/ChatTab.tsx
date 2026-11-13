import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loading, QueryError } from "@/components/states";
import { itemsQuery, settingsQuery } from "@/features/pantry/data";
import { CookChat } from "./CookChat";
import { nutritionQuery } from "./data";
import { toNutritionRows } from "./nutrition";
import { useOpenAiSettings } from "./open-settings";

export function ChatTab() {
  const items = useQuery(itemsQuery);
  const nutrition = useQuery(nutritionQuery);
  const settings = useQuery(settingsQuery);
  const openSettings = useOpenAiSettings();
  const rows = useMemo(() => toNutritionRows(nutrition.data ?? []), [nutrition.data]);

  if (items.isLoading || nutrition.isLoading || settings.isLoading) return <Loading rows={2} />;
  if (items.isError || nutrition.isError || settings.isError || !items.data || !settings.data) {
    return (
      <QueryError
        onRetry={() => {
          void items.refetch();
          void nutrition.refetch();
          void settings.refetch();
        }}
      />
    );
  }
  return <CookChat settings={settings.data} items={items.data} nutrition={rows} onOpenSettings={openSettings} />;
}
