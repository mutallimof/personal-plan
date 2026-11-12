import { cn } from "@/lib/utils";
import { iconUrl } from "./registry";

/** A product picture. The file loads when the picture is first shown. */
export function ItemIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    <img
      src={iconUrl(icon)}
      alt=""
      loading="lazy"
      draggable={false}
      className={cn("h-8 w-8 select-none", className)}
    />
  );
}
