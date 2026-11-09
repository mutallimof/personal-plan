import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Photo and screen tests do real work; a busy machine needs more than the default 1 s to find the result.
configure({ asyncUtilTimeout: 10_000 });

// Tests that run in the node environment (src/test/migrations.test.ts) have no window.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: () => {},
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
