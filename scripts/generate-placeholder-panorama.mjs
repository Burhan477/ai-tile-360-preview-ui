// Generates the placeholder equirectangular panorama used by the 360° viewer
// until real room photography is supplied (see public/panoramas/README.md).
//
// It ray-casts a simple box room (floor tiles, walls, window, door) from eye
// height and writes a 2:1 PNG, plus matching grayscale floor and wall masks
// (white = tileable surface) used by the tile renderers. No dependencies
// beyond Node's standard library.
//
// Usage: node scripts/generate-placeholder-panorama.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WIDTH = 4096;
const HEIGHT = 2048;
const SAMPLES = 2; // per axis, for anti-aliasing

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "public/panoramas/placeholder-room.png");
const MASK_OUTPUT = resolve(ROOT, "public/masks/placeholder-room-floor.png");
const WALL_MASK_OUTPUT = resolve(ROOT, "public/masks/living-room-wall.png");

// Room in metres. Camera sits at eye height, slightly off-centre.
// Keep in sync with PLACEHOLDER_PANORAMA.floor/.wall in src/constants/panoramas.ts.
const ROOM = { minX: -3, maxX: 3, minZ: -2.6, maxZ: 2.6, height: 2.8 };
const EYE = { x: 0.25, y: 1.6, z: 0.35 };

// Floor tile layout (600 × 1200 mm) with 3 mm grout.
const TILE_W = 0.6;
const TILE_L = 1.2;
const GROUT = 0.003;

const COLORS = {
  wall: [233, 226, 216],
  wallShade: [214, 205, 193],
  skirting: [196, 186, 172],
  ceiling: [244, 241, 236],
  tileA: [214, 199, 176],
  tileB: [205, 189, 165],
  grout: [168, 156, 140],
  skyTop: [158, 196, 230],
  skyBottom: [226, 236, 242],
  frame: [250, 249, 246],
  door: [120, 90, 64],
  doorFrame: [236, 230, 222],
};

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const scale = (c, f) => c.map((v) => v * f);

function floorColor(x, z) {
  // Stagger every other row by half a tile, like a running bond.
  const row = Math.floor(z / TILE_W);
  const offset = row % 2 === 0 ? 0 : TILE_L / 2;
  const col = Math.floor((x + offset) / TILE_L);
  const lx = x + offset - col * TILE_L;
  const lz = z - row * TILE_W;

  if (lx < GROUT || lz < GROUT) return COLORS.grout;

  const base = hash(col, row) > 0.5 ? COLORS.tileA : COLORS.tileB;
  // Soft veining so the stone does not look flat.
  const vein = Math.sin(x * 9 + Math.sin(z * 5) * 2 + hash(col, row) * 6);
  return scale(base, 0.97 + vein * 0.025);
}

/**
 * Colour for a wall point. `u` runs along the wall (m), `y` is height.
 * `tileable` is false for skirting, the window and the door (and their
 * frames), which wall tiles must not cover.
 */
function wallColor(wall, u, y) {
  if (y < 0.1) return { color: COLORS.skirting, tileable: false };

  if (wall === "front") {
    // Window: 2.2 m wide, 0.9–2.3 m high, centred.
    const inX = Math.abs(u) < 1.1;
    const inY = y > 0.9 && y < 2.3;
    if (inX && inY) {
      const frame = Math.abs(u) > 1.04 || y < 0.96 || y > 2.24 || Math.abs(u) < 0.03;
      if (frame) return { color: COLORS.frame, tileable: false };
      return { color: mix(COLORS.skyBottom, COLORS.skyTop, (y - 0.9) / 1.4), tileable: false };
    }
  }

  if (wall === "right") {
    // Door: 0.9 m wide, 2.1 m high.
    const du = u - 0.8;
    if (Math.abs(du) < 0.52 && y < 2.18) {
      if (Math.abs(du) > 0.45 || y > 2.1) return { color: COLORS.doorFrame, tileable: false };
      const panel = Math.abs(du) < 0.35 && ((y > 0.25 && y < 0.95) || (y > 1.15 && y < 1.95));
      return { color: panel ? scale(COLORS.door, 0.9) : COLORS.door, tileable: false };
    }
  }

  // Gentle vertical gradient: darker near the floor.
  return {
    color: mix(COLORS.wallShade, COLORS.wall, Math.min(1, y / ROOM.height + 0.2)),
    tileable: true,
  };
}

function trace(dx, dy, dz) {
  let t = Infinity;
  let hit = null;

  const tryPlane = (tp, surface) => {
    if (tp > 0 && tp < t) {
      t = tp;
      hit = surface;
    }
  };

  if (dy < 0) tryPlane(-EYE.y / dy, "floor");
  if (dy > 0) tryPlane((ROOM.height - EYE.y) / dy, "ceiling");
  if (dx > 0) tryPlane((ROOM.maxX - EYE.x) / dx, "right");
  if (dx < 0) tryPlane((ROOM.minX - EYE.x) / dx, "left");
  if (dz < 0) tryPlane((ROOM.minZ - EYE.z) / dz, "front");
  if (dz > 0) tryPlane((ROOM.maxZ - EYE.z) / dz, "back");

  const x = EYE.x + dx * t;
  const y = EYE.y + dy * t;
  const z = EYE.z + dz * t;

  let color;
  let isWall = false;
  switch (hit) {
    case "floor":
      color = floorColor(x, z);
      break;
    case "ceiling":
      color = COLORS.ceiling;
      break;
    default: {
      const u = { front: x, back: -x, right: z, left: -z }[hit];
      ({ color, tileable: isWall } = wallColor(hit, u, y));
    }
  }

  // Cheap ambient occlusion: darken towards room edges and corners.
  const edge = Math.min(
    x - ROOM.minX,
    ROOM.maxX - x,
    z - ROOM.minZ,
    ROOM.maxZ - z,
  );
  const vertical = Math.min(y, ROOM.height - y);
  const occlusion = 1 - 0.12 * Math.exp(-edge * 4) - 0.1 * Math.exp(-vertical * 5);

  return { color: scale(color, occlusion), isFloor: hit === "floor", isWall };
}

/** `channels`: 3 for RGB, 1 for grayscale. */
function encodePng(width, height, pixels, channels) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 1; // "Sub" filter
    for (let i = 0; i < stride; i++) {
      const cur = pixels[y * stride + i];
      const left = i >= channels ? pixels[y * stride + i - channels] : 0;
      raw[rowStart + 1 + i] = (cur - left) & 0xff;
    }
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
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = channels === 3 ? 2 : 0; // colour type: RGB or grayscale

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
const mask = new Uint8Array(WIDTH * HEIGHT);
const wallMask = new Uint8Array(WIDTH * HEIGHT);
for (let py = 0; py < HEIGHT; py++) {
  for (let px = 0; px < WIDTH; px++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let floor = 0;
    let wall = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const u = (px + (sx + 0.5) / SAMPLES) / WIDTH;
        const v = (py + (sy + 0.5) / SAMPLES) / HEIGHT;
        // Equirectangular: u = 0.5 faces -Z ("front"), increasing u turns right.
        const lon = (u - 0.5) * 2 * Math.PI;
        const lat = (0.5 - v) * Math.PI;
        const { color: c, isFloor, isWall } = trace(
          Math.cos(lat) * Math.sin(lon),
          Math.sin(lat),
          -Math.cos(lat) * Math.cos(lon),
        );
        r += c[0];
        g += c[1];
        b += c[2];
        if (isFloor) floor += 1;
        if (isWall) wall += 1;
      }
    }
    const n = SAMPLES * SAMPLES;
    const i = (py * WIDTH + px) * 3;
    pixels[i] = Math.round(r / n);
    pixels[i + 1] = Math.round(g / n);
    pixels[i + 2] = Math.round(b / n);
    // Partial coverage gives anti-aliased edges along the skirting line.
    mask[py * WIDTH + px] = Math.round((floor / n) * 255);
    wallMask[py * WIDTH + px] = Math.round((wall / n) * 255);
  }
}

for (const [file, data, channels] of [
  [OUTPUT, pixels, 3],
  [MASK_OUTPUT, mask, 1],
  [WALL_MASK_OUTPUT, wallMask, 1],
]) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(WIDTH, HEIGHT, data, channels));
  console.log(`Wrote ${file}`);
}
