import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// The design sheets exist in development only: the import is dropped from production builds, and the address is "not found" there.
const Sheets = import.meta.env.DEV ? lazy(() => import("@/features/design/DesignSheets")) : null;

export const Route = createFileRoute("/design")({
  ssr: false,
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  head: () => ({ meta: [{ title: "Design sheets — Lifeplan" }, { name: "robots", content: "noindex" }] }),
  component: () => (Sheets ? <Suspense fallback={null}><Sheets /></Suspense> : null),
});
