import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Plain Vite setup for TanStack Start + React + Tailwind v4.
// nitro only runs in `vite build`. It picks the output format from the host it builds on
// (Vercel and Cloudflare Pages are detected automatically); locally it builds a Node server.
// Do not add compression here: the host already compresses at the edge.
export default defineConfig(({ command }) => ({
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // Use src/server.ts (our SSR error wrapper) as TanStack Start's server entry.
    tanstackStart({ server: { entry: "server" } }),
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
  ],
}));
