/**
 * Generates every TokenGauge icon from the session character.
 *
 * Two drawings for two jobs:
 *   - the TRAY MARK has to read at 16px, so it is the bun, a leaf and a face drawn
 *     with one-pixel strokes. Its colour and its face both change with the state,
 *     so colour is never the only signal;
 *   - the APP TILE is the full character on a plum plate.
 * The tile's paths mirror the session character in src/components/Mascot.tsx.
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
const INK = "#24162C";
const STICKER = "#FFFFFF";
const LEAF = "#6BD6A8";

/** One pixel at 16px is 32 units, so nothing that must survive goes below that. */
const FACE_STROKE = 38;
const round = `stroke="${INK}" stroke-width="${FACE_STROKE}" stroke-linecap="round" fill="none"`;
const eyes = (r) => `<circle cx="172" cy="272" r="${r}" fill="${INK}"/><circle cx="340" cy="272" r="${r}" fill="${INK}"/>`;

const FACES = {
  happy: `${eyes(40)}<path d="M190 356Q256 424 322 356" ${round}/>`,
  worried: `${eyes(40)}<path d="M190 398Q256 338 322 398" ${round}/>`,
  alarmed: `${eyes(50)}<ellipse cx="256" cy="384" rx="44" ry="50" fill="${INK}"/>`,
  asleep: `<path d="M126 276H218M294 276H386" ${round}/><path d="M212 376H300" ${round}/>`,
};

const TRAY_STATES = {
  icon_normal: { color: "#F0862E", face: "happy" },
  icon_warning: { color: "#F4BC3C", face: "worried" },
  icon_critical: { color: "#E5483D", face: "alarmed" },
  icon_disabled: { color: "#A59EB3", face: "asleep" },
};

const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none">
${body}
</svg>`;

function trayMark({ color, face }) {
  return wrap(`  <path d="M268 84C292 26 360 10 424 34C414 106 342 132 268 84Z" fill="${LEAF}" stroke="${STICKER}" stroke-width="24" stroke-linejoin="round" paint-order="stroke"/>
  <circle cx="256" cy="292" r="208" fill="${color}" stroke="${STICKER}" stroke-width="28" paint-order="stroke"/>
  ${FACES[face]}`);
}

function appTile() {
  return wrap(`  <rect width="${SIZE}" height="${SIZE}" rx="116" fill="#2B1A33"/>
  <g transform="translate(46 56) scale(4.2)" stroke-linejoin="round">
    <path d="M52 17c5-11 16-13 23-9-2 10-12 16-23 9Z" fill="${LEAF}" stroke="${STICKER}" stroke-width="5" paint-order="stroke"/>
    <path d="M50 19c22 0 40 16 40 36 0 21-18 33-40 33S10 76 10 55c0-20 18-36 40-36Z" fill="#F0862E" stroke="${STICKER}" stroke-width="5" paint-order="stroke"/>
    <ellipse cx="50" cy="74" rx="20" ry="11" fill="#FFC48E"/>
    <ellipse cx="29" cy="60" rx="6" ry="4" fill="#FF9FB4"/>
    <ellipse cx="71" cy="60" rx="6" ry="4" fill="#FF9FB4"/>
    <circle cx="37" cy="50" r="4" fill="${INK}"/>
    <circle cx="63" cy="50" r="4" fill="${INK}"/>
    <path d="M43 60c3 5 11 5 14 0" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  </g>`);
}

const work = mkdtempSync(join(tmpdir(), "tokengauge-icons-"));
const icons = join(process.cwd(), "src-tauri", "icons");
const tauri = (args) => execFileSync("npx", ["tauri", ...args], { stdio: "inherit", shell: process.platform === "win32" });

try {
  // The app tile drives the full platform set (icon.ico, icon.png, Square*Logo, icns, android, ios).
  const tile = join(work, "icon.svg");
  writeFileSync(tile, appTile());
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
