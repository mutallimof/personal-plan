import { cn } from "@/lib/utils";

/** The sprout paths, shared by the in-app mark, public/favicon.svg and scripts/make-icons.mjs (64 x 64 box). */
export const SPROUT = {
  stem: "M32 51V35",
  big: "M32 36C32 24 39.5 16 51 14.5C51.5 26.5 44 36 32 36Z",
  small: "M32 42C32 34.5 26 29 16.5 28C16.5 36.5 22.5 42 32 42Z",
} as const;

/** The mark: a sprout on a rounded tile. Takes the theme's primary colour. */
export function LogoMark({ className, animated = false }: { className?: string | undefined; animated?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8 shrink-0", className)} aria-hidden="true">
      <rect width="64" height="64" rx="17" className="fill-primary" />
      <path d={SPROUT.stem} className="stroke-primary-foreground" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d={SPROUT.big} className={cn("fill-primary-foreground", animated && "origin-[32px_36px] animate-leaf [animation-delay:120ms]")} />
      <path d={SPROUT.small} className={cn("fill-primary-foreground", animated && "origin-[32px_42px] animate-leaf [animation-delay:260ms]")} />
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
