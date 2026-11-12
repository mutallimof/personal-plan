import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/** A full-screen panel over the kitchen. Escape, the close button and the browser back button all close it. */
export function PantrySheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      {/* The title and the close button stay put; only the part below them scrolls. */}
      <SheetContent side="bottom" className="flex h-dvh w-full max-w-none flex-col gap-0 border-0 p-0 sm:rounded-none" onOpenAutoFocus={(e) => e.preventDefault()}>
        <header className="mx-auto flex h-[4.25rem] w-full max-w-3xl shrink-0 items-center pl-4 pr-16">
          <SheetTitle className="truncate text-2xl">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">{children}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
