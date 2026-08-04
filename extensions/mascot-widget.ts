// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor")
// Source: https://pi.dev/docs/latest/extensions
// La mascotte reprend automatiquement les couleurs sémantiques du thème Pi courant.

import type { ExtensionAPI, ExtensionContext, ThemeColor } from "@earendil-works/pi-coding-agent";

const DEFAULT_GAP = 2;
const MAX_GAP = 8;
export const MASCOT_PREFERENCES_TYPE = "pi-claude-mascot.preferences";
export const MASCOT_USAGE = "Usage: /mascot [on|off|label [on|off]|gap 0-8|status|reset|help]";
export const MASCOT_SPARKLE_FRAMES = ["·", "✢", "✶", "✻", "✽", "✻", "✶", "✢", "·"] as const;
export const MASCOT_SPARKLE_INTERVAL_MS = 120;
export const MASCOT_HELP = [
  "/mascot             Toggle mascot",
  "/mascot on|off      Enable or disable mascot",
  "/mascot label       Toggle PI CODE label",
  "/mascot label on|off Show or hide PI CODE label",
  "/mascot gap 0-8     Set spacing between mascot and label",
  "/mascot status      Show current settings and state",
  "/mascot reset       Restore default settings",
  "/mascot help        Show this help",
].join("\n");

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
  sparkle?: string;
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

export type MascotCommand =
  | { type: "toggle" }
  | { type: "set-enabled"; value: boolean }
  | { type: "toggle-label" }
  | { type: "set-label"; value: boolean }
  | { type: "set-gap"; value: number }
  | { type: "status" }
  | { type: "reset" }
  | { type: "help" }
  | { type: "invalid" };

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

export function isMascotAnimatedState(state: MascotState): boolean {
  return state === "thinking" || state === "working";
}

export function parseMascotCommand(args: string): MascotCommand {
  const tokens = args.trim() ? args.trim().split(/\s+/) : [];
  const [action, value] = tokens;
  const normalizedAction = action?.toLowerCase();
  const normalizedValue = value?.toLowerCase();

  if (tokens.length === 0) return { type: "toggle" };

  if ((normalizedAction === "on" || normalizedAction === "off") && tokens.length === 1) {
    return { type: "set-enabled", value: normalizedAction === "on" };
  }

  if (normalizedAction === "label" && tokens.length === 1) return { type: "toggle-label" };

  if (
    normalizedAction === "label" &&
    tokens.length === 2 &&
    (normalizedValue === "on" || normalizedValue === "off")
  ) {
    return { type: "set-label", value: normalizedValue === "on" };
  }

  if (normalizedAction === "gap" && tokens.length === 2 && /^[0-8]$/.test(value ?? "")) {
    return { type: "set-gap", value: Number(value) };
  }

  if (normalizedAction === "status" && tokens.length === 1) return { type: "status" };
  if (normalizedAction === "reset" && tokens.length === 1) return { type: "reset" };
  if (normalizedAction === "help" && tokens.length === 1) return { type: "help" };

  return { type: "invalid" };
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
  const sparkle = options.sparkle ?? MASCOT_SPARKLE_FRAMES[0];
  const mascotRows = [
    ` ${colorize(`${MASCOT_ART[0]}${sparkle}`)}`,
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
  let setSparkleAnimation: ((active: boolean) => void) | undefined;

  const persistPreferences = (): void => {
    pi.appendEntry<MascotPreferences>(MASCOT_PREFERENCES_TYPE, {
      enabled,
      showLabel,
      gap,
    });
  };

  const getPreferences = (): MascotPreferences => ({ enabled, showLabel, gap });

  const updatePreferences = (next: MascotPreferences): boolean => {
    const current = getPreferences();
    if (
      current.enabled === next.enabled &&
      current.showLabel === next.showLabel &&
      current.gap === next.gap
    ) {
      return false;
    }

    enabled = next.enabled;
    showLabel = next.showLabel;
    gap = next.gap;
    setSparkleAnimation?.(enabled && isMascotAnimatedState(state));
    requestRender?.();
    persistPreferences();
    return true;
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
    setSparkleAnimation?.(enabled && isMascotAnimatedState(state));
    requestRender?.();
  };

  const installWidget = (ctx: ExtensionContext): void => {
    ctx.ui.setWidget("mascot", (tui, theme) => {
      let sparkleIndex = 0;
      let sparkleTimer: ReturnType<typeof setInterval> | undefined;
      const renderRequest = (): void => tui.requestRender();
      const stopSparkle = (): void => {
        if (sparkleTimer === undefined) return;
        clearInterval(sparkleTimer);
        sparkleTimer = undefined;
        sparkleIndex = 0;
      };
      const startSparkle = (): void => {
        if (sparkleTimer !== undefined) return;
        sparkleTimer = setInterval(() => {
          sparkleIndex = (sparkleIndex + 1) % MASCOT_SPARKLE_FRAMES.length;
          renderRequest();
        }, MASCOT_SPARKLE_INTERVAL_MS);
        const timerWithUnref = sparkleTimer as unknown as { unref?: () => void };
        timerWithUnref.unref?.();
      };
      setSparkleAnimation = (active) => {
        if (active) startSparkle();
        else stopSparkle();
      };
      requestRender = renderRequest;

      return {
        // State and sparkle frame are read during every render.
        render: (_width: number): string[] =>
          enabled
            ? renderMascot((text) => theme.fg(MASCOT_STATE_COLORS[state], text), {
                showLabel,
                gap,
                sparkle: MASCOT_SPARKLE_FRAMES[sparkleIndex],
              })
            : [],
        invalidate(): void {},
        dispose(): void {
          stopSparkle();
          setSparkleAnimation = undefined;
          if (requestRender === renderRequest) requestRender = undefined;
        },
      };
    });
  };

  pi.registerCommand("mascot", {
    description: "Control mascot: on, off, label, gap, status, reset, or help",
    handler: async (args, ctx) => {
      const command = parseMascotCommand(args);

      if (command.type === "toggle") {
        updatePreferences({ ...getPreferences(), enabled: !enabled });
        ctx.ui.notify(`Mascot ${enabled ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (command.type === "set-enabled") {
        updatePreferences({ ...getPreferences(), enabled: command.value });
        ctx.ui.notify(`Mascot ${enabled ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (command.type === "toggle-label") {
        updatePreferences({ ...getPreferences(), showLabel: !showLabel });
        ctx.ui.notify(`PI CODE label ${showLabel ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (command.type === "set-label") {
        updatePreferences({ ...getPreferences(), showLabel: command.value });
        ctx.ui.notify(`PI CODE label ${showLabel ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (command.type === "set-gap") {
        updatePreferences({ ...getPreferences(), gap: command.value });
        ctx.ui.notify(`Mascot gap: ${gap}`, "info");
        return;
      }

      if (command.type === "status") {
        ctx.ui.notify(formatMascotStatus(enabled, showLabel, gap, state), "info");
        return;
      }

      if (command.type === "reset") {
        updatePreferences({ enabled: true, showLabel: true, gap: DEFAULT_GAP });
        ctx.ui.notify("Mascot settings reset", "info");
        return;
      }

      if (command.type === "help") {
        ctx.ui.notify(MASCOT_HELP, "info");
        return;
      }

      ctx.ui.notify(MASCOT_USAGE, "error");
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
