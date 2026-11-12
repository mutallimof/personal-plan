import { cn } from "@/lib/utils";

/** The sprout paths, shared by the in-app mark, public/favicon.svg and scripts/make-icons.mjs (64 x 64 box). */
export const SPROUT = {
  stem: "M29.75 37.5H34.25V50.5A2.25 2.25 0 0 1 29.75 50.5Z",
  big: "M32 38C32 25 39.5 16 51 14.5C51.5 27 44 37.5 32 38Z",
  small: "M32 38C31 31 25 26 16 26C16 34 22 38.5 32 38Z",
} as const;

/** The mark: a sprout on a rounded tile. Takes the theme's primary colour. */
export function LogoMark({ className, animated = false }: { className?: string | undefined; animated?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8 shrink-0", className)} aria-hidden="true">
      <rect width="64" height="64" rx="17" className="fill-primary" />
      <path d={SPROUT.stem} className="fill-primary-foreground" />
      <path d={SPROUT.big} className={cn("fill-primary-foreground", animated && "origin-[32px_38px] animate-leaf [animation-delay:120ms]")} />
      <path d={SPROUT.small} className={cn("fill-primary-foreground", animated && "origin-[32px_38px] animate-leaf [animation-delay:260ms]")} />
    </svg>
  );
}

/** Mark and name side by side. */
export function Logo({ className, markClassName }: { className?: string | undefined; markClassName?: string | undefined }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="font-heading text-xl font-bold">Lifeplan</span>
    </span>
  );
}
