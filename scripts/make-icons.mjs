// Generates the PWA icons (public/icons/*.png) from the same dumbbell shape as public/favicon.svg.
// No dependencies: rasterises the shapes with 4x supersampling and writes PNG by hand.
//   node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const GREEN = [0x22, 0xc5, 0x5e];
const WHITE = [255, 255, 255];
// Dumbbell rects in the favicon's 64x64 space: [x, y, w, h, radius]
const BELLS = [
  [10, 22, 7, 20, 2.5],
  [18, 26, 5, 12, 2],
  [26, 30, 12, 4, 2],
  [41, 26, 5, 12, 2],
  [47, 22, 7, 20, 2.5],
];

function inRoundRect(px, py, [x, y, w, h, r]) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

/** size px square. rounded: rounded-corner tile on transparent. maskable: full-bleed with a smaller mark. */
function render(size, { rounded, scale }) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      let g = 0, w = 0;
      for (let sj = 0; sj < SS; sj++)
        for (let si = 0; si < SS; si++) {
          const u = ((i + (si + 0.5) / SS) / size) * 64;
          const v = ((j + (sj + 0.5) / SS) / size) * 64;
          if (!rounded || inRoundRect(u, v, [0, 0, 64, 64, 14])) {
            g++;
            const mu = (u - 32) / scale + 32;
            const mv = (v - 32) / scale + 32;
            if (BELLS.some((b) => inRoundRect(mu, mv, b))) w++;
          }
        }
      const n = SS * SS;
      const o = (j * size + i) * 4;
      const wf = w / n, gf = (g - w) / n;
      px[o] = Math.round(WHITE[0] * wf + GREEN[0] * gf);
      px[o + 1] = Math.round(WHITE[1] * wf + GREEN[1] * gf);
      px[o + 2] = Math.round(WHITE[2] * wf + GREEN[2] * gf);
      px[o + 3] = Math.round(((g) / n) * 255);
    }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, { rounded: true, scale: 1 }],
  ["icon-512.png", 512, { rounded: true, scale: 1 }],
  ["icon-maskable-512.png", 512, { rounded: false, scale: 0.72 }], // mark stays inside the 80% safe zone
  ["apple-touch-icon.png", 180, { rounded: false, scale: 0.9 }], // iOS rounds the corners itself
];
for (const [name, size, opts] of out) writeFileSync(`public/icons/${name}`, png(size, render(size, opts)));
console.log("wrote", out.map((o) => o[0]).join(", "));
