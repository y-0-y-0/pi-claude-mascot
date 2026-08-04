// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor")
// Source: https://pi.dev/docs/latest/extensions
// La mascotte reprend automatiquement la couleur "accent" du thème Pi courant.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const GLYPH_WIDTH = 3;
const LETTER_GAP = " ";
const WORD_GAP = "  ";
const MASCOT_WIDTH = 9;

export const MASCOT_ART = [
  "▐▛███▜▌",
  "▝▜█████▛▘",
  "▘▘ ▝▝",
] as const;

const PI_CODE_GLYPHS = [
  ["██", "███", "███", "███", "██", "███"],
  ["█ █", " █", "█", "█ █", "█ █", "█"],
  ["██", " █", "█", "█ █", "█ █", "██"],
  ["█", " █", "█", "█ █", "█ █", "█"],
  ["█", "███", "███", "███", "██", "███"],
] as const;

function renderTextRow(glyphs: readonly string[]): string {
  const padded = glyphs.map((glyph) => glyph.padEnd(GLYPH_WIDTH, " "));
  return `${padded.slice(0, 2).join(LETTER_GAP)}${WORD_GAP}${padded
    .slice(2)
    .join(LETTER_GAP)}`;
}

export const PI_CODE_ART = PI_CODE_GLYPHS.map(renderTextRow);

function centerMascotRow(row: string): string {
  const leftPadding = Math.floor((MASCOT_WIDTH - row.length) / 2);
  return `${" ".repeat(leftPadding)}${row}`.padEnd(MASCOT_WIDTH, " ");
}

export function renderMascot(colorize: (text: string) => string): string[] {
  const mascotRows = [
    " ".repeat(MASCOT_WIDTH),
    centerMascotRow(MASCOT_ART[0]),
    centerMascotRow(MASCOT_ART[1]),
    centerMascotRow(MASCOT_ART[2]),
    " ".repeat(MASCOT_WIDTH),
  ];

  return PI_CODE_ART.map(
    (textRow, index) => `${colorize(mascotRows[index] ?? "")}  ${colorize(textRow)}`,
  );
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
