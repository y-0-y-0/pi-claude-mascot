// Source: https://pi.dev/docs/latest/tui ("Widgets Above/Below Editor")
// Source: https://pi.dev/docs/latest/extensions
// La mascotte reprend automatiquement les couleurs sémantiques du thème Pi courant.

import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import {
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import type { ExtensionAPI, ExtensionContext, ThemeColor } from "@earendil-works/pi-coding-agent";
import { WITTY_LOADING_PHRASES } from "./witty-phrases.ts";

const DEFAULT_GAP = 2;
const MAX_GAP = 8;
export const MASCOT_MAX_GLOBAL_PREFERENCES_BYTES = 4096;
export const MASCOT_PREFERENCES_TYPE = "pi-claude-mascot.preferences";
export const MASCOT_GLOBAL_PREFERENCES_ENV = "PI_CLAUDE_MASCOT_PREFERENCES_PATH";
export const MASCOT_USAGE = "Usage: /mascot [on|off|label [on|off]|gap 0-8|status|reset|help]";
export const MASCOT_SPARKLE_FRAMES = ["·", "✢", "✶", "✻", "✽", "✻", "✶", "✢", "·"] as const;
export const MASCOT_SPARKLE_INTERVAL_MS = 200;
export const WITTY_LOADING_PHRASES_INTERVAL_MS = 2500;
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
  "██▀█▄ ██   ▄████ ▄███▄ ████▄ ██▀▀▀",
  "██▀▀  ██   ██▄▄▄ ██▄██ ██▄██ ██▀▀",
  "▀▀    ▀▀    ▀▀▀▀  ▀▀▀  ▀▀▀▀  ▀▀▀▀▀",
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

const INITIAL_PREFERENCES: MascotPreferences = {
  enabled: true,
  showLabel: true,
  gap: DEFAULT_GAP,
};

type MascotSettledState = "success" | "error";
type MascotWarningNotifier = (message: string) => void;

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

const MASCOT_ARGUMENT_COMPLETIONS: readonly AutocompleteItem[] = [
  { value: "on", label: "on", description: "Enable mascot" },
  { value: "off", label: "off", description: "Disable mascot" },
  { value: "label", label: "label", description: "Toggle PI CODE label" },
  { value: "label on", label: "label on", description: "Show PI CODE label" },
  { value: "label off", label: "label off", description: "Hide PI CODE label" },
  { value: "gap", label: "gap", description: "Set spacing from 0 to 8" },
  ...Array.from({ length: MAX_GAP + 1 }, (_, value) => ({
    value: `gap ${value}`,
    label: `gap ${value}`,
    description: `Set mascot gap to ${value}`,
  })),
  { value: "status", label: "status", description: "Show current settings and state" },
  { value: "reset", label: "reset", description: "Restore default settings" },
  { value: "help", label: "help", description: "Show command help" },
];

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

export function getGlobalPreferencesPath(): string {
  const configuredPath = expandHomePath(process.env[MASCOT_GLOBAL_PREFERENCES_ENV]?.trim() ?? "");
  if (configuredPath && isAbsolute(configuredPath)) return configuredPath;

  const configuredAgentDir = expandHomePath(process.env.PI_CODING_AGENT_DIR?.trim() ?? "");
  const agentDir =
    configuredAgentDir && isAbsolute(configuredAgentDir)
      ? configuredAgentDir
      : join(homedir(), ".pi", "agent");
  return join(agentDir, "pi-claude-mascot.json");
}

function expandHomePath(value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return join(homedir(), value.slice(2));
  return value;
}

export function readGlobalPreferences(filePath = getGlobalPreferencesPath()): MascotPreferences | undefined {
  if (!isAbsolute(filePath)) return undefined;

  let fileDescriptor: number | undefined;
  try {
    const linkMetadata = lstatSync(filePath);
    if (!linkMetadata.isFile() || linkMetadata.size > MASCOT_MAX_GLOBAL_PREFERENCES_BYTES) return undefined;

    fileDescriptor = openSync(filePath, "r");
    const metadata = fstatSync(fileDescriptor);
    if (!metadata.isFile() || metadata.size > MASCOT_MAX_GLOBAL_PREFERENCES_BYTES) return undefined;

    const buffer = Buffer.alloc(MASCOT_MAX_GLOBAL_PREFERENCES_BYTES + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const chunkSize = readSync(fileDescriptor, buffer, bytesRead, buffer.length - bytesRead, bytesRead);
      if (chunkSize === 0) break;
      bytesRead += chunkSize;
    }
    if (bytesRead > MASCOT_MAX_GLOBAL_PREFERENCES_BYTES) return undefined;

    const data: unknown = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
    return isMascotPreferences(data) ? data : undefined;
  } catch {
    return undefined;
  } finally {
    if (fileDescriptor !== undefined) {
      try {
        closeSync(fileDescriptor);
      } catch {
        // The descriptor may already be closed after a failed filesystem operation.
      }
    }
  }
}

export function writeGlobalPreferences(
  preferences: MascotPreferences,
  filePath = getGlobalPreferencesPath(),
): boolean {
  if (!isMascotPreferences(preferences) || !isAbsolute(filePath)) return false;

  let temporaryPath: string | undefined;
  let temporaryFileDescriptor: number | undefined;
  let temporaryFileCreated = false;
  let persisted = false;

  try {
    const generatedTemporaryPath = `${filePath}.${process.pid}.${randomBytes(16).toString("hex")}.tmp`;
    temporaryPath = generatedTemporaryPath;
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
    temporaryFileDescriptor = openSync(generatedTemporaryPath, "wx", 0o600);
    temporaryFileCreated = true;
    writeFileSync(temporaryFileDescriptor, `${JSON.stringify(preferences, null, 2)}\n`, "utf8");
    closeSync(temporaryFileDescriptor);
    temporaryFileDescriptor = undefined;
    renameSync(generatedTemporaryPath, filePath);
    temporaryFileCreated = false;
    persisted = true;
  } catch {
    // Session persistence remains available if global file storage is unavailable.
  } finally {
    if (temporaryFileDescriptor !== undefined) {
      try {
        closeSync(temporaryFileDescriptor);
      } catch {
        // The descriptor may already be closed after a failed filesystem operation.
      }
    }
    if (temporaryFileCreated && temporaryPath !== undefined) {
      try {
        unlinkSync(temporaryPath);
      } catch {
        // The temporary file may already be absent after a failed filesystem operation.
      }
    }
  }
  return persisted;
}

export function isMascotAnimatedState(state: MascotState): boolean {
  return state === "thinking" || state === "working";
}

function hasAgentFailure(messages: readonly unknown[] | undefined): boolean {
  return (
    messages?.some((message) => {
      if (typeof message !== "object" || message === null) return false;

      const candidate = message as { role?: unknown; stopReason?: unknown };
      return (
        candidate.role === "assistant" &&
        (candidate.stopReason === "error" || candidate.stopReason === "aborted")
      );
    }) ?? false
  );
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

export function getMascotArgumentCompletions(argumentPrefix: string): AutocompleteItem[] | null {
  const prefix = argumentPrefix.trimStart().toLowerCase();
  const matching = MASCOT_ARGUMENT_COMPLETIONS.filter((item) => item.value.startsWith(prefix));
  return matching.length > 0 ? matching : null;
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

export function getMascotRenderWidth(options: MascotRenderOptions = {}): number {
  return Math.max(0, ...renderMascot((text) => text, options).map((line) => line.length));
}

export default function (pi: ExtensionAPI): void {
  let enabled = INITIAL_PREFERENCES.enabled;
  let showLabel = INITIAL_PREFERENCES.showLabel;
  let gap = INITIAL_PREFERENCES.gap;
  let state: MascotState = "idle";
  let activeToolCalls = new Set<string>();
  let failedToolCalls = new Set<string>();
  let pendingAgentState: MascotSettledState | undefined;
  let globalPersistenceWarningShown = false;
  let requestRender: (() => void) | undefined;
  let setSparkleAnimation: ((active: boolean) => void) | undefined;
  let setWorkingMessage: ((message: string) => void) | undefined;
  let wittyPhraseTimer: ReturnType<typeof setInterval> | undefined;
  let wittyPhraseIndex = 0;
  let wittyPhraseNeedsInitialMessage = false;

  const stopWittyPhraseRotation = (): void => {
    if (wittyPhraseTimer !== undefined) clearInterval(wittyPhraseTimer);
    wittyPhraseTimer = undefined;
    wittyPhraseIndex = 0;
    wittyPhraseNeedsInitialMessage = true;
  };

  const advanceWittyPhrase = (): void => {
    wittyPhraseIndex = (wittyPhraseIndex + 1) % WITTY_LOADING_PHRASES.length;
    setWorkingMessage?.(WITTY_LOADING_PHRASES[wittyPhraseIndex] ?? WITTY_LOADING_PHRASES[0]);
  };

  const startWittyPhraseRotation = (): void => {
    if (setWorkingMessage === undefined || wittyPhraseTimer !== undefined) return;
    if (wittyPhraseNeedsInitialMessage) {
      setWorkingMessage(WITTY_LOADING_PHRASES[0] ?? "Working...");
      wittyPhraseNeedsInitialMessage = false;
    }
    wittyPhraseTimer = setInterval(advanceWittyPhrase, WITTY_LOADING_PHRASES_INTERVAL_MS);
    const timerWithUnref = wittyPhraseTimer as unknown as { unref?: () => void };
    timerWithUnref.unref?.();
  };

  const persistPreferences = (notifyWarning?: MascotWarningNotifier): void => {
    const preferences: MascotPreferences = {
      enabled,
      showLabel,
      gap,
    };
    pi.appendEntry<MascotPreferences>(MASCOT_PREFERENCES_TYPE, preferences);
    if (!writeGlobalPreferences(preferences) && !globalPersistenceWarningShown) {
      globalPersistenceWarningShown = true;
      notifyWarning?.("Mascot global preferences could not be saved; session preferences remain available.");
    }
  };

  const getPreferences = (): MascotPreferences => ({ enabled, showLabel, gap });

  const updatePreferences = (next: MascotPreferences, notifyWarning?: MascotWarningNotifier): boolean => {
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
    persistPreferences(notifyWarning);
    return true;
  };

  const restorePreferences = (ctx: ExtensionContext): boolean => {
    const current = getPreferences();
    let restored = INITIAL_PREFERENCES;
    const globalPreferences = readGlobalPreferences();
    if (globalPreferences) restored = globalPreferences;

    for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
      if (entry.type !== "custom" || entry.customType !== MASCOT_PREFERENCES_TYPE) continue;
      if (!isMascotPreferences(entry.data)) continue;

      restored = entry.data;
      break;
    }

    enabled = restored.enabled;
    showLabel = restored.showLabel;
    gap = restored.gap;
    return (
      current.enabled !== restored.enabled ||
      current.showLabel !== restored.showLabel ||
      current.gap !== restored.gap
    );
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
      const updateSparkleAnimation = (active: boolean): void => {
        if (active) startSparkle();
        else stopSparkle();
      };
      setSparkleAnimation = updateSparkleAnimation;
      requestRender = renderRequest;

      return {
        // State and sparkle frame are read during every render.
        render: (width: number): string[] => {
          if (!enabled || !Number.isFinite(width)) return [];

          const options: MascotRenderOptions = {
            showLabel,
            gap,
            sparkle: MASCOT_SPARKLE_FRAMES[sparkleIndex] ?? MASCOT_SPARKLE_FRAMES[0],
          };
          if (width < getMascotRenderWidth(options)) return [];

          return renderMascot((text) => theme.fg(MASCOT_STATE_COLORS[state], text), options);
        },
        invalidate(): void {},
        dispose(): void {
          stopSparkle();
          if (setSparkleAnimation === updateSparkleAnimation) setSparkleAnimation = undefined;
          if (requestRender === renderRequest) requestRender = undefined;
        },
      };
    });
  };

  pi.registerCommand("mascot", {
    description: "Control mascot: on, off, label, gap, status, reset, or help",
    getArgumentCompletions: getMascotArgumentCompletions,
    handler: async (args, ctx) => {
      const command = parseMascotCommand(args);
      const notifyPersistenceWarning: MascotWarningNotifier = (message) => ctx.ui.notify(message, "warning");

      if (command.type === "toggle") {
        updatePreferences({ ...getPreferences(), enabled: !enabled }, notifyPersistenceWarning);
        ctx.ui.notify(`Mascot ${enabled ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (command.type === "set-enabled") {
        updatePreferences({ ...getPreferences(), enabled: command.value }, notifyPersistenceWarning);
        ctx.ui.notify(`Mascot ${enabled ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (command.type === "toggle-label") {
        updatePreferences({ ...getPreferences(), showLabel: !showLabel }, notifyPersistenceWarning);
        ctx.ui.notify(`PI CODE label ${showLabel ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (command.type === "set-label") {
        updatePreferences({ ...getPreferences(), showLabel: command.value }, notifyPersistenceWarning);
        ctx.ui.notify(`PI CODE label ${showLabel ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (command.type === "set-gap") {
        updatePreferences({ ...getPreferences(), gap: command.value }, notifyPersistenceWarning);
        ctx.ui.notify(`Mascot gap: ${gap}`, "info");
        return;
      }

      if (command.type === "status") {
        ctx.ui.notify(formatMascotStatus(enabled, showLabel, gap, state), "info");
        return;
      }

      if (command.type === "reset") {
        updatePreferences({ enabled: true, showLabel: false, gap: DEFAULT_GAP }, notifyPersistenceWarning);
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
    globalPersistenceWarningShown = false;
    setSparkleAnimation?.(false);
    stopWittyPhraseRotation();
    setSparkleAnimation = undefined;
    requestRender = undefined;
    setWorkingMessage = ctx.ui.setWorkingMessage?.bind(ctx.ui);
    setWorkingMessage?.(WITTY_LOADING_PHRASES[0] ?? "Working...");
    wittyPhraseNeedsInitialMessage = false;
    state = "idle";
    activeToolCalls = new Set<string>();
    failedToolCalls = new Set<string>();
    pendingAgentState = undefined;
    restorePreferences(ctx);
    installWidget(ctx);
  });

  pi.on("session_shutdown", () => {
    stopWittyPhraseRotation();
    setWorkingMessage = undefined;
  });

  pi.on("session_tree", (_event, ctx) => {
    const changed = restorePreferences(ctx);
    setSparkleAnimation?.(enabled && isMascotAnimatedState(state));
    if (changed) requestRender?.();
  });

  pi.on("agent_start", () => {
    activeToolCalls = new Set<string>();
    failedToolCalls = new Set<string>();
    pendingAgentState = undefined;
    startWittyPhraseRotation();
    setState("thinking");
  });

  pi.on("turn_start", () => {
    setState("thinking");
  });

  pi.on("tool_execution_start", (event) => {
    activeToolCalls.add(event.toolCallId);
    failedToolCalls.delete(event.toolCallId);
    setState("working");
  });

  pi.on("tool_execution_end", (event) => {
    activeToolCalls.delete(event.toolCallId);
    if (event.isError) failedToolCalls.add(event.toolCallId);

    if (activeToolCalls.size > 0) {
      setState("working");
      return;
    }

    setState(failedToolCalls.size > 0 ? "error" : "thinking");
  });

  pi.on("agent_end", (event) => {
    activeToolCalls.clear();
    pendingAgentState = failedToolCalls.size > 0 || hasAgentFailure(event.messages) ? "error" : "success";
    setState("thinking");
  });

  pi.on("agent_settled", () => {
    stopWittyPhraseRotation();
    const settledState = pendingAgentState ?? (failedToolCalls.size > 0 ? "error" : "success");
    pendingAgentState = undefined;
    failedToolCalls = new Set<string>();
    setState(settledState);
  });

}
