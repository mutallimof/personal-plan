import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pub = (p: string) => path.resolve(__dirname, "../../public", p.replace(/^\//, ""));

describe("PWA files", () => {
  const manifest = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8"));

  it("has what Chrome needs to offer install", () => {
    expect(manifest.name).toBe("Lifeplan");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/gym");
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  });

  it("only points at icons that exist and are real PNGs", () => {
    for (const icon of manifest.icons as { src: string }[]) {
      expect(existsSync(pub(icon.src))).toBe(true);
      expect(readFileSync(pub(icon.src)).subarray(1, 4).toString()).toBe("PNG");
    }
    expect(existsSync(pub("icons/apple-touch-icon.png"))).toBe(true);
  });

  it("ships the offline page and a service worker that never handles non-GET or cross-origin requests", () => {
    expect(existsSync(pub("offline.html"))).toBe(true);
    const sw = readFileSync(pub("sw.js"), "utf8");
    expect(sw).toContain('req.method !== "GET"');
    expect(sw).toContain("url.origin !== self.location.origin");
    expect(sw).toContain("/offline.html");
  });
});
