import { LogoMark } from "@/components/Logo";

/** The opening screen while the app checks who you are. */
export function Splash() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background">
      <LogoMark animated className="h-20 w-20 animate-breathe [animation-delay:900ms]" />
      <span className="font-heading animate-rise text-2xl font-bold [animation-delay:350ms]">Lifeplan</span>
    </div>
  );
}
