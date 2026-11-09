import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A tiny page that draws the kitchen scene with invented data, for screenshots (see shoot.mjs).
export default defineConfig({
  root: __dirname,
  publicDir: path.resolve(__dirname, "../../public"),
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "../../src") },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  server: { port: 5199, strictPort: true },
});
