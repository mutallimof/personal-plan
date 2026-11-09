import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/** A full-screen panel over the kitchen. Escape, the close button and the browser back button all close it. */
export function PantrySheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-dvh w-full max-w-none overflow-y-auto p-0 sm:rounded-none">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-10 pt-5">
          <SheetTitle className="pr-10 text-xl">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
