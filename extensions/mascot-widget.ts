// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor").
// Source: https://pi.dev/docs/latest/extensions.
// La mascotte reprend automatiquement couleur "accent" du thème Pi courant.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DRAWING_WIDTH = 9;

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setWidget("mascot", (_tui, theme) => {
      // Recalcule style depuis thème à chaque rendu : aucun ANSI ni hexadécimal figé.
      const body = (text: string): string => theme.fg("accent", text);
      return {
        render(width: number): string[] {
          const safeWidth = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
          const leftPadding = Math.max(0, safeWidth - DRAWING_WIDTH);
          const padding = " ".repeat(leftPadding);

          return [
            padding + " " + body("▐▛███▜▌") + " ",
            padding + body("▝▜█████▛▘"),
            padding + "  " + body("▘▘ ▝▝") + "  ",
          ];
        },
        invalidate(): void {},
      };
    });
  });
}
