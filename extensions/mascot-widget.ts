// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor").
// Source: https://pi.dev/docs/latest/extensions.
// La mascotte reprend automatiquement la couleur "accent" du thème Pi courant.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const MASCOT_ART = [
  "▐▛███▜▌",
  "▝▜█████▛▘",
  "  ▘▘ ▝▝",
] as const;

const DRAWING_WIDTH = MASCOT_ART[1].length;

function normalizeWidth(width: number): number {
  return Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
}

function fitLine(line: string, width: number): string {
  const boxedLine = line.padEnd(DRAWING_WIDTH, " ");
  if (width === 0) return "";
  if (width < DRAWING_WIDTH) return boxedLine.slice(-width);
  return boxedLine;
}

export function renderMascot(width: number, colorize: (text: string) => string): string[] {
  const safeWidth = normalizeWidth(width);
  const leftPadding = Math.max(0, safeWidth - DRAWING_WIDTH);
  const padding = " ".repeat(leftPadding);

  return MASCOT_ART.map((line) => {
    const fittedLine = fitLine(line, safeWidth);
    if (fittedLine.length === 0) return "";
    return padding + colorize(fittedLine);
  });
}

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setWidget("mascot", (_tui, theme) => ({
      // Style est recalculé à chaque rendu : aucun ANSI ni hexadécimal figé.
      render: (width: number): string[] =>
        renderMascot(width, (text) => theme.fg("accent", text)),
      // Aucun état dynamique à invalider.
      invalidate(): void {},
    }));
  });
}
