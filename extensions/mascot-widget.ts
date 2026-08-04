// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor")
// Source: https://pi.dev/docs/latest/extensions
// La mascotte reprend automatiquement la couleur "accent" du thème Pi courant.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ASCII_GLYPH_WIDTH = 5;
const ASCII_WORD_GAP = "  ";

export const MASCOT_ART = [
  "▐▛███▜▌",
  "▝▜█████▛▘",
  "▘▘ ▝▝",
] as const;

const PI_CODE_GLYPHS = [
  ["####", "#####", "####", "###", "###", "#####"],
  ["#   #", "  #  ", "#", "#   #", "#  #", "#"],
  ["####", "#####", "####", "###", "###", "#####"],
] as const;

function renderAsciiRow(glyphs: readonly string[]): string {
  const paddedGlyphs = glyphs.map((glyph) => glyph.padEnd(ASCII_GLYPH_WIDTH, " "));
  return `${paddedGlyphs.slice(0, 2).join(" ")}${ASCII_WORD_GAP}${paddedGlyphs
    .slice(2)
    .join(" ")}`;
}

export const PI_CODE_ART = PI_CODE_GLYPHS.map(renderAsciiRow);

export function renderMascot(colorize: (text: string) => string): string[] {
  const mascotRows = [
    ` ${colorize(MASCOT_ART[0])} `,
    colorize(MASCOT_ART[1]),
    `  ${colorize(MASCOT_ART[2])}  `,
  ];

  return mascotRows.map((row, index) => `${row}  ${colorize(PI_CODE_ART[index] ?? "")}`);
}

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setWidget("mascot", (_tui, theme) => ({
      render: (_width: number): string[] =>
        renderMascot((text) => theme.fg("accent", text)),
      invalidate(): void {},
    }));
  });
}
