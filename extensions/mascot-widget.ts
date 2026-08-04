// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor")
// Source: https://pi.dev/docs/latest/extensions
// La mascotte reprend automatiquement la couleur "accent" du thème Pi courant.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const MASCOT_ART = [
  "▐▛███▜▌",
  "▝▜█████▛▘",
  "▘▘ ▝▝",
] as const;

export const PI_CODE_ART = [
  "█████▄ ██   ▄█████ ▄████▄ ████▄  ██████",
  "██▄▄█▀ ██   ██     ██  ██ ██  ██ ██▄▄",
  "██     ██   ▀█████ ▀████▀ ████▀  ██▄▄▄▄",
] as const;

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
