/**
 * Generates every TokenGauge icon from two parametric sources.
 *
 * They are two different jobs, so they are two different drawings:
 *   - the TRAY MARK is a 16px glyph — open arc, needle, no field;
 *   - the APP TILE is a 256px Windows 11 plate — a dial with ticks and a pivot.
 * Both are the product's own geometry, never a provider's glyph — see DESIGN.md.
 * Keep the tray mark's constants in sync with src/components/BrandMark.tsx,
 * which draws the same shape in the UI.
 *
 * Usage: node scripts/gen-icons.mjs
 * Requires: @tauri-apps/cli (already a dev dependency) — it rasterizes the SVG
 * and writes every platform size, so nothing here needs an image library.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SIZE = 512;
const CENTER = SIZE / 2;

/* ---- Tray mark: the open gauge, tuned so it survives 16px. ---- */
const RADIUS = 176;
const STROKE = 78; // heavier than the in-app mark: this has to read at 16px
const NEEDLE = 84;
const NEEDLE_STROKE = 40;
const HUB = 28;
const START = 138;
const SWEEP = 264;

/** Track color works on both a light and a dark taskbar. */
const TRACK = "#7C7C7C";
const TRACK_OPACITY = 0.55;

/**
 * The failure this geometry exists to fix: a round-capped needle whose tip
 * reaches the arc's inner edge fuses into it, and the mark becomes one blob.
 * One pixel of clearance at 16px is 32 units at this scale.
 */
const clearance = RADIUS - STROKE / 2 - (NEEDLE + NEEDLE_STROKE / 2);
if (clearance < 32) {
  throw new Error(`needle clears the arc by ${clearance} units (<32) — it will fuse at 16px`);
}

/* ---- App tile: Windows 11 plate with a 180° dial. ---- */
const TILE_CORNER = 116;
const DIAL = { cx: 256, cy: 330, radius: 162, stroke: 40, start: 180, sweep: 180 };
const DIAL_TRACK = "#4A443E";
const TICK = "#7A7068";
const TICKS = 5;

const TRAY_STATES = {
  icon_normal: { color: "#D4845A", fill: 0.55 },
  icon_warning: { color: "#E0A63A", fill: 0.78 },
  icon_critical: { color: "#E05B4A", fill: 0.97 },
  icon_disabled: { color: "#8A8A8A", fill: 0 },
};

/** The app tile is static branding, not a reading — it rests where normal does. */
const APP_TILE = { color: "#D4845A", fill: 0.55 };

const point = (deg, r, cx = CENTER, cy = CENTER) => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)].map((n) => n.toFixed(2));
};

const arc = (fromDeg, toDeg, r, cx = CENTER, cy = CENTER) => {
  const [x1, y1] = point(fromDeg, r, cx, cy);
  const [x2, y2] = point(toDeg, r, cx, cy);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none">
${body}
</svg>`;

function trayMark({ color, fill }) {
  const end = START + SWEEP * fill;
  const [nx, ny] = point(end, NEEDLE);
  const filled = fill > 0
    ? `  <path d="${arc(START, end, RADIUS)}" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round"/>`
    : "";

  return wrap(`  <path d="${arc(START, START + SWEEP, RADIUS)}" stroke="${TRACK}" stroke-opacity="${TRACK_OPACITY}" stroke-width="${STROKE}" stroke-linecap="round"/>
${filled}
  <path d="M${CENTER} ${CENTER} L${nx} ${ny}" stroke="${color}" stroke-width="${NEEDLE_STROKE}" stroke-linecap="round"/>
  <circle cx="${CENTER}" cy="${CENTER}" r="${HUB}" fill="${color}"/>`);
}

function appTile({ color, fill }) {
  const { cx, cy, radius, stroke, start, sweep } = DIAL;
  const end = start + sweep * fill;

  let ticks = "";
  for (let i = 0; i < TICKS; i++) {
    const deg = start + (sweep / (TICKS - 1)) * i;
    const [x1, y1] = point(deg, 118, cx, cy);
    const [x2, y2] = point(deg, 138, cx, cy);
    ticks += `  <path d="M${x1} ${y1} L${x2} ${y2}" stroke="${TICK}" stroke-width="11" stroke-linecap="round"/>\n`;
  }

  // A tapered needle: wide at the pivot, a point at the scale.
  const [tx, ty] = point(end, 128, cx, cy);
  const [b1x, b1y] = point(end + 90, 14, cx, cy);
  const [b2x, b2y] = point(end - 90, 14, cx, cy);

  return wrap(`  <defs>
    <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2A2826"/>
      <stop offset="1" stop-color="#131211"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${TILE_CORNER}" fill="url(#plate)"/>
  <rect x="4" y="4" width="${SIZE - 8}" height="${SIZE - 8}" rx="${TILE_CORNER - 4}" fill="none" stroke="#FFFFFF" stroke-opacity="0.07" stroke-width="6"/>
${ticks}  <path d="${arc(start, start + sweep, radius, cx, cy)}" stroke="${DIAL_TRACK}" stroke-width="${stroke}" stroke-linecap="round"/>
  <path d="${arc(start, end, radius, cx, cy)}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>
  <polygon points="${tx},${ty} ${b1x},${b1y} ${b2x},${b2y}" fill="${color}"/>
  <circle cx="${cx}" cy="${cy}" r="23" fill="${color}"/>
  <circle cx="${cx}" cy="${cy}" r="8" fill="#131211"/>`);
}

const work = mkdtempSync(join(tmpdir(), "tokengauge-icons-"));
const icons = join(process.cwd(), "src-tauri", "icons");
const tauri = (args) => execFileSync("npx", ["tauri", ...args], { stdio: "inherit", shell: process.platform === "win32" });

try {
  // The app tile drives the full platform set (icon.ico, icon.png, Square*Logo, icns, android, ios).
  const tile = join(work, "icon.svg");
  writeFileSync(tile, appTile(APP_TILE));
  tauri(["icon", tile]);

  // Tray states: only the .ico is used, so generate into a scratch directory
  // and lift the one file out.
  for (const [name, spec] of Object.entries(TRAY_STATES)) {
    const source = join(work, `${name}.svg`);
    writeFileSync(source, trayMark(spec));

    const out = join(work, name);
    mkdirSync(out, { recursive: true });
    tauri(["icon", source, "-o", out]);
    copyFileSync(join(out, "icon.ico"), join(icons, `${name}.ico`));
  }

  console.log("\nicons written to src-tauri/icons");
} finally {
  rmSync(work, { recursive: true, force: true });
}
