// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor").
// Source: https://pi.dev/docs/latest/extensions.
// La mascotte reprend automatiquement couleur "accent" du thème Pi courant.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setWidget("mascot", (_tui, theme) => {
      // Recalcule style depuis thème à chaque rendu : aucun ANSI ni hexadécimal figé.
      const body = (text: string): string => theme.fg("accent", text);
      return {
        render(_width: number): string[] {
          const padding = "";

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
