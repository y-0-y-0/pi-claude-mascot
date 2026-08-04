// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor")
// Source: https://pi.dev/docs/latest/extensions
// La mascotte reprend automatiquement la couleur "accent" du thème Pi courant.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const DEFAULT_GAP = 2;
const MAX_GAP = 8;

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

export type MascotRenderOptions = {
  showLabel?: boolean;
  gap?: number;
};

export function normalizeGap(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GAP;
  return Math.min(MAX_GAP, Math.max(0, Math.floor(value)));
}

export function renderMascot(
  colorize: (text: string) => string,
  options: MascotRenderOptions = {},
): string[] {
  const mascotRows = [
    ` ${colorize(MASCOT_ART[0])} `,
    colorize(MASCOT_ART[1]),
    `  ${colorize(MASCOT_ART[2])}  `,
  ];

  if (options.showLabel === false) return mascotRows;

  const gap = " ".repeat(normalizeGap(options.gap ?? DEFAULT_GAP));
  return mascotRows.map((row, index) => `${row}${gap}${colorize(PI_CODE_ART[index] ?? "")}`);
}

export default function (pi: ExtensionAPI): void {
  let enabled = true;
  let showLabel = true;
  let gap = DEFAULT_GAP;

  const installWidget = (ctx: ExtensionContext): void => {
    ctx.ui.setWidget("mascot", (_tui, theme) => ({
      render: (_width: number): string[] =>
        renderMascot((text) => theme.fg("accent", text), { showLabel, gap }),
      invalidate(): void {},
    }));
  };

  pi.registerCommand("mascot", {
    description: "Toggle Pi mascot visibility",
    handler: async (_args, ctx) => {
      enabled = !enabled;
      if (enabled) {
        installWidget(ctx);
      } else {
        ctx.ui.setWidget("mascot", undefined);
      }
      ctx.ui.notify(`Mascot ${enabled ? "enabled" : "disabled"}`, "info");
    },
  });

  pi.registerCommand("mascot-label", {
    description: "Toggle PI CODE label",
    handler: async (_args, ctx) => {
      showLabel = !showLabel;
      if (enabled) installWidget(ctx);
      ctx.ui.notify(`PI CODE label ${showLabel ? "enabled" : "disabled"}`, "info");
    },
  });

  pi.registerCommand("mascot-gap", {
    description: "Set mascot-to-label gap from 0 to 8 spaces",
    handler: async (args, ctx) => {
      const value = Number(args.trim());
      if (!Number.isInteger(value) || value < 0 || value > MAX_GAP) {
        ctx.ui.notify("Usage: /mascot-gap 0-8", "error");
        return;
      }
      gap = value;
      if (enabled) installWidget(ctx);
      ctx.ui.notify(`Mascot gap: ${gap}`, "info");
    },
  });

  pi.on("session_start", (_event, ctx) => {
    if (enabled) installWidget(ctx);
  });
}
