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

function boxLine(line: string): string {
  return line.padEnd(DRAWING_WIDTH, " ");
}

export function renderMascot(width: number, colorize: (text: string) => string): string[] {
  const safeWidth = normalizeWidth(width);
  if (safeWidth < DRAWING_WIDTH) return [];

  const leftPadding = safeWidth - DRAWING_WIDTH;
  const padding = " ".repeat(leftPadding);

  return MASCOT_ART.map((line) => padding + colorize(boxLine(line)));
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
