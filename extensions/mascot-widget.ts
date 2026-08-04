// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor")
// Source: https://pi.dev/docs/latest/extensions
// La mascotte reprend automatiquement les couleurs sémantiques du thème Pi courant.

import type { ExtensionAPI, ExtensionContext, ThemeColor } from "@earendil-works/pi-coding-agent";

const DEFAULT_GAP = 2;
const MAX_GAP = 8;
export const MASCOT_PREFERENCES_TYPE = "pi-claude-mascot.preferences";

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

export const MASCOT_STATES = ["idle", "thinking", "working", "success", "error"] as const;

export type MascotState = (typeof MASCOT_STATES)[number];

export const MASCOT_STATE_COLORS: Readonly<Record<MascotState, ThemeColor>> = {
  idle: "accent",
  thinking: "thinkingText",
  working: "warning",
  success: "success",
  error: "error",
};

export type MascotPreferences = {
  enabled: boolean;
  showLabel: boolean;
  gap: number;
};

export function normalizeGap(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GAP;
  return Math.min(MAX_GAP, Math.max(0, Math.floor(value)));
}

export function isMascotPreferences(value: unknown): value is MascotPreferences {
  if (typeof value !== "object" || value === null) return false;

  const preferences = value as Partial<MascotPreferences>;
  return (
    typeof preferences.enabled === "boolean" &&
    typeof preferences.showLabel === "boolean" &&
    typeof preferences.gap === "number" &&
    Number.isInteger(preferences.gap) &&
    preferences.gap >= 0 &&
    preferences.gap <= MAX_GAP
  );
}

export function formatMascotStatus(
  enabled: boolean,
  showLabel: boolean,
  gap: number,
  state: MascotState,
): string {
  return `Mascot: ${enabled ? "enabled" : "disabled"}; PI CODE label: ${showLabel ? "enabled" : "disabled"}; Gap: ${gap}; State: ${state}`;
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
  let state: MascotState = "idle";
  let lastToolFailed = false;
  let requestRender: (() => void) | undefined;

  const persistPreferences = (): void => {
    pi.appendEntry<MascotPreferences>(MASCOT_PREFERENCES_TYPE, {
      enabled,
      showLabel,
      gap,
    });
  };

  const restorePreferences = (ctx: ExtensionContext): void => {
    for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
      if (entry.type !== "custom" || entry.customType !== MASCOT_PREFERENCES_TYPE) continue;
      if (!isMascotPreferences(entry.data)) continue;

      enabled = entry.data.enabled;
      showLabel = entry.data.showLabel;
      gap = entry.data.gap;
      return;
    }
  };

  const setState = (nextState: MascotState): void => {
    if (state === nextState) return;
    state = nextState;
    requestRender?.();
  };

  const installWidget = (ctx: ExtensionContext): void => {
    ctx.ui.setWidget("mascot", (tui, theme) => {
      requestRender = () => tui.requestRender();

      return {
        // State is read during every render, so commands do not need to reinstall widget.
        render: (_width: number): string[] =>
          enabled
            ? renderMascot((text) => theme.fg(MASCOT_STATE_COLORS[state], text), { showLabel, gap })
            : [],
        invalidate(): void {},
      };
    });
  };

  pi.registerCommand("mascot", {
    description: "Control mascot: on, off, label, gap, or status",
    handler: async (args, ctx) => {
      const tokens = args.trim() ? args.trim().split(/\s+/) : [];
      const [action, value] = tokens;
      const normalizedAction = action?.toLowerCase();
      const normalizedValue = value?.toLowerCase();

      if (tokens.length === 0) {
        enabled = !enabled;
        requestRender?.();
        persistPreferences();
        ctx.ui.notify(`Mascot ${enabled ? "enabled" : "disabled"}`, "info");
        return;
      }

      if ((normalizedAction === "on" || normalizedAction === "off") && tokens.length === 1) {
        enabled = normalizedAction === "on";
        requestRender?.();
        persistPreferences();
        ctx.ui.notify(`Mascot ${enabled ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (normalizedAction === "label" && tokens.length === 1) {
        showLabel = !showLabel;
        requestRender?.();
        persistPreferences();
        ctx.ui.notify(`PI CODE label ${showLabel ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (
        normalizedAction === "label" &&
        tokens.length === 2 &&
        (normalizedValue === "on" || normalizedValue === "off")
      ) {
        showLabel = normalizedValue === "on";
        requestRender?.();
        persistPreferences();
        ctx.ui.notify(`PI CODE label ${showLabel ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (normalizedAction === "gap" && tokens.length === 2 && /^[0-8]$/.test(value ?? "")) {
        gap = Number(value);
        requestRender?.();
        persistPreferences();
        ctx.ui.notify(`Mascot gap: ${gap}`, "info");
        return;
      }

      if (normalizedAction === "status" && tokens.length === 1) {
        ctx.ui.notify(formatMascotStatus(enabled, showLabel, gap, state), "info");
        return;
      }

      ctx.ui.notify("Usage: /mascot [on|off|label [on|off]|gap 0-8|status]", "error");
    },
  });

  pi.on("session_start", (_event, ctx) => {
    state = "idle";
    lastToolFailed = false;
    requestRender = undefined;
    restorePreferences(ctx);
    installWidget(ctx);
  });

  pi.on("agent_start", () => {
    lastToolFailed = false;
    setState("thinking");
  });

  pi.on("turn_start", () => {
    setState("thinking");
  });

  pi.on("tool_execution_start", () => {
    setState("working");
  });

  pi.on("tool_execution_end", (event) => {
    if (event.isError) lastToolFailed = true;
    setState(event.isError ? "error" : "thinking");
  });

  pi.on("agent_end", () => {
    setState(lastToolFailed ? "error" : "success");
  });

}
