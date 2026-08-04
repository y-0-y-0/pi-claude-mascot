import { strict as assert } from "node:assert";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync, writeFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerMascot, {
  MASCOT_ART,
  MASCOT_GLOBAL_PREFERENCES_ENV,
  MASCOT_HELP,
  MASCOT_PREFERENCES_TYPE,
  MASCOT_SPARKLE_FRAMES,
  MASCOT_SPARKLE_INTERVAL_MS,
  MASCOT_USAGE,
  MASCOT_STATE_COLORS,
  PI_CODE_ART,
  formatMascotStatus,
  getGlobalPreferencesPath,
  isMascotAnimatedState,
  isMascotPreferences,
  normalizeGap,
  parseMascotCommand,
  renderMascot,
  readGlobalPreferences,
  writeGlobalPreferences,
} from "../extensions/mascot-widget.ts";

const TEST_GLOBAL_PREFERENCES_PATH = join(tmpdir(), `pi-claude-mascot-test-${process.pid}.json`);
process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = TEST_GLOBAL_PREFERENCES_PATH;
beforeEach(() => {
  rmSync(TEST_GLOBAL_PREFERENCES_PATH, { force: true });
});

type MascotTheme = {
  fg(color: string, text: string): string;
};

type MascotWidget = {
  render(width: number): string[];
  invalidate(): void;
  dispose?(): void;
};
type MascotContext = {
  ui: {
    setWidget(
      key: string,
      factory: (tui: { requestRender(): void }, theme: MascotTheme) => MascotWidget,
    ): void;
    notify(message: string, type?: "info" | "warning" | "error"): void;
  };
  sessionManager: {
    getBranch(): Array<{ type: string; customType?: string; data?: unknown }>;
  };
};

type MascotHandler = (event: unknown, context: MascotContext) => void;

type CommandDefinition = {
  handler(args: string, context: MascotContext): Promise<void> | void;
};

const EXPECTED_LINES = [
  ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}  ${PI_CODE_ART[0]}`,
  `${MASCOT_ART[1]}  ${PI_CODE_ART[1]}`,
  `  ${MASCOT_ART[2]}    ${PI_CODE_ART[2]}`,
];

test("registers mascot widget on session_start with default placement", () => {
  let sessionStart: MascotHandler | undefined;
  let widgetFactory: ((tui: { requestRender(): void }, theme: MascotTheme) => MascotWidget) | undefined;
  const registeredCommands = new Map<string, CommandDefinition>();
  const events = new Map<string, MascotHandler>();

  const pi = {
    registerCommand(name: string, definition: CommandDefinition): void {
      registeredCommands.set(name, definition);
    },
    on(event: string, handler: MascotHandler): void {
      events.set(event, handler);
      if (event === "session_start") sessionStart = handler;
    },
  } as unknown as ExtensionAPI;

  registerMascot(pi);
  assert.deepEqual([...registeredCommands.keys()], ["mascot"]);
  assert.ok(sessionStart);

  sessionStart({}, {
    ui: {
      setWidget(key, factory): void {
        assert.equal(key, "mascot");
        widgetFactory = factory;
      },
      notify(): void {},
    },
    sessionManager: { getBranch: () => [] },
  });

  assert.ok(widgetFactory);
  const widget = widgetFactory({ requestRender(): void {} }, {
    fg: (color, text) => {
      assert.equal(color, "accent");
      return text;
    },
  });

  assert.deepEqual(widget.render(80), EXPECTED_LINES);
  assert.doesNotThrow(() => widget.invalidate());
  widget.dispose?.();
  assert.ok(events.has("agent_start"));
  assert.ok(events.has("tool_execution_start"));
  assert.ok(events.has("agent_end"));
});

test("renders supplied three-row PI CODE artwork beside mascot", () => {
  const lines = renderMascot((text) => text);

  assert.deepEqual(lines, EXPECTED_LINES);
  assert.equal(PI_CODE_ART.length, 3);
  assert.ok(PI_CODE_ART.every((line) => /^[█▄▀ ]+$/.test(line)));
  assert.deepEqual(lines.map((line) => line.length), [50, 48, 50]);

  const noLabel = renderMascot((text) => text, { showLabel: false });
  assert.deepEqual(noLabel, [
    ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}`,
    MASCOT_ART[1],
    `  ${MASCOT_ART[2]}  `,
  ]);

  const widerGap = renderMascot((text) => text, { gap: 4 });
  assert.equal(widerGap[0], ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}    ${PI_CODE_ART[0]}`);
});

test("renders requested sparkle frame and exposes animation timing", () => {
  assert.equal(MASCOT_SPARKLE_INTERVAL_MS, 120);
  assert.deepEqual(MASCOT_SPARKLE_FRAMES, ["·", "✢", "✶", "✻", "✽", "✻", "✶", "✢", "·"]);
  assert.equal(
    renderMascot((text) => text, { showLabel: false, sparkle: "✽" })[0],
    ` ${MASCOT_ART[0]}✽`,
  );
});

test("animates only during thinking or working states", async () => {
  assert.equal(isMascotAnimatedState("idle"), false);
  assert.equal(isMascotAnimatedState("thinking"), true);
  assert.equal(isMascotAnimatedState("working"), true);
  assert.equal(isMascotAnimatedState("success"), false);
  assert.equal(isMascotAnimatedState("error"), false);

  let sessionStart: MascotHandler | undefined;
  let widgetFactory: ((tui: { requestRender(): void }, theme: MascotTheme) => MascotWidget) | undefined;
  const events = new Map<string, MascotHandler>();
  let renderRequests = 0;
  const pi = {
    registerCommand(): void {},
    on(event: string, handler: MascotHandler): void {
      events.set(event, handler);
      if (event === "session_start") sessionStart = handler;
    },
  } as unknown as ExtensionAPI;

  registerMascot(pi);
  sessionStart?.({}, {
    ui: {
      setWidget(_key, factory): void {
        widgetFactory = factory;
      },
      notify(): void {},
    },
    sessionManager: { getBranch: () => [] },
  });
  assert.ok(widgetFactory);
  const widget = widgetFactory({ requestRender: () => renderRequests++ }, { fg: (_color, text) => text });

  await new Promise((resolve) => setTimeout(resolve, MASCOT_SPARKLE_INTERVAL_MS + 30));
  assert.equal(renderRequests, 0);

  events.get("agent_start")?.({}, {} as MascotContext);
  await new Promise((resolve) => setTimeout(resolve, MASCOT_SPARKLE_INTERVAL_MS + 30));
  assert.ok(renderRequests > 0);

  events.get("agent_end")?.({}, {} as MascotContext);
  const requestsAfterIdle = renderRequests;
  await new Promise((resolve) => setTimeout(resolve, MASCOT_SPARKLE_INTERVAL_MS + 30));
  assert.equal(renderRequests, requestsAfterIdle);
  widget.dispose?.();
});

test("normalizes configurable gap safely", () => {
  assert.equal(normalizeGap(4), 4);
  assert.equal(normalizeGap(-2), 0);
  assert.equal(normalizeGap(99), 8);
  assert.equal(normalizeGap(Number.NaN), 2);
});

test("parses mascot commands strictly", () => {
  assert.deepEqual(parseMascotCommand(""), { type: "toggle" });
  assert.deepEqual(parseMascotCommand("  OFF  "), { type: "set-enabled", value: false });
  assert.deepEqual(parseMascotCommand("label"), { type: "toggle-label" });
  assert.deepEqual(parseMascotCommand("label on"), { type: "set-label", value: true });
  assert.deepEqual(parseMascotCommand("gap 8"), { type: "set-gap", value: 8 });
  assert.deepEqual(parseMascotCommand("status"), { type: "status" });
  assert.deepEqual(parseMascotCommand("reset"), { type: "reset" });
  assert.deepEqual(parseMascotCommand("help"), { type: "help" });
  assert.deepEqual(parseMascotCommand("gap 9"), { type: "invalid" });
  assert.deepEqual(parseMascotCommand("label off extra"), { type: "invalid" });
  assert.deepEqual(parseMascotCommand("unknown"), { type: "invalid" });
});

test("applies active theme colorizer to mascot and every PI CODE row", () => {
  const accent = renderMascot((text) => `<accent>${text}</accent>`);
  const muted = renderMascot((text) => `<muted>${text}</muted>`);

  assert.notDeepEqual(accent, muted);
  assert.equal(accent.length, 3);
  assert.ok(accent.every((line) => line.includes("<accent>")));
  assert.ok(accent.every((line) => !line.includes("<muted>")));
});

test("validates and formats persisted preferences", () => {
  assert.equal(isMascotPreferences({ enabled: true, showLabel: false, gap: 4 }), true);
  assert.equal(isMascotPreferences({ enabled: true, showLabel: false, gap: 9 }), false);
  assert.equal(isMascotPreferences({ enabled: true, showLabel: false, gap: 2.5 }), false);
  assert.equal(isMascotPreferences(undefined), false);
  assert.equal(MASCOT_PREFERENCES_TYPE, "pi-claude-mascot.preferences");
  assert.deepEqual(MASCOT_STATE_COLORS, {
    idle: "accent",
    thinking: "thinkingText",
    working: "warning",
    success: "success",
    error: "error",
  });
  assert.equal(
    formatMascotStatus(false, true, 3, "working"),
    "Mascot: disabled; PI CODE label: enabled; Gap: 3; State: working",
  );
});

test("persists preferences globally for new sessions", async () => {
  let sessionStart: MascotHandler | undefined;
  let command: CommandDefinition | undefined;
  let widgetFactory: ((tui: { requestRender(): void }, theme: MascotTheme) => MascotWidget) | undefined;
  const pi = {
    registerCommand(_name: string, definition: CommandDefinition): void {
      command = definition;
    },
    appendEntry(): void {},
    on(event: string, handler: MascotHandler): void {
      if (event === "session_start") sessionStart = handler;
    },
  } as unknown as ExtensionAPI;
  const context: MascotContext = {
    ui: {
      setWidget(_key, factory): void {
        widgetFactory = factory;
      },
      notify(): void {},
    },
    sessionManager: { getBranch: () => [] },
  };

  registerMascot(pi);
  sessionStart?.({}, context);
  assert.ok(command);
  await command.handler("reset", context);
  assert.deepEqual(readGlobalPreferences(), { enabled: true, showLabel: false, gap: 2 });

  sessionStart?.({}, context);
  assert.ok(widgetFactory);
  const widget = widgetFactory({ requestRender(): void {} }, { fg: (_color, text) => text });
  assert.deepEqual(widget.render(80), [
    ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}`,
    MASCOT_ART[1],
    `  ${MASCOT_ART[2]}  `,
  ]);
  assert.equal(getGlobalPreferencesPath(), TEST_GLOBAL_PREFERENCES_PATH);
  widget.dispose?.();
});

test("ignores malformed global preferences", () => {
  writeGlobalPreferences({ enabled: true, showLabel: false, gap: 2 });
  const invalidPath = TEST_GLOBAL_PREFERENCES_PATH;
  process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = invalidPath;
  writeFileSync(invalidPath, "not-json", "utf8");
  assert.equal(readGlobalPreferences(invalidPath), undefined);
});

test("handles strict mascot commands, persistence, and live widget updates", async () => {
  let sessionStart: MascotHandler | undefined;
  let widgetFactory: ((tui: { requestRender(): void }, theme: MascotTheme) => MascotWidget) | undefined;
  let command: CommandDefinition | undefined;
  let requestRenderCount = 0;
  let widgetInstallCount = 0;
  const renderedColors: string[] = [];
  const notifications: Array<{ message: string; type?: "info" | "warning" | "error" }> = [];
  const appended: Array<{ customType: string; data: unknown }> = [];
  const events = new Map<string, MascotHandler>();

  const pi = {
    registerCommand(_name: string, definition: CommandDefinition): void {
      command = definition;
    },
    appendEntry(customType: string, data: unknown): void {
      appended.push({ customType, data });
    },
    on(event: string, handler: MascotHandler): void {
      events.set(event, handler);
      if (event === "session_start") sessionStart = handler;
    },
  } as unknown as ExtensionAPI;

  registerMascot(pi);
  assert.ok(sessionStart);
  assert.ok(command);

  const context: MascotContext = {
    ui: {
      setWidget(_key, factory): void {
        widgetInstallCount += 1;
        widgetFactory = factory;
      },
      notify(message, type): void {
        notifications.push({ message, type });
      },
    },
    sessionManager: { getBranch: () => [] },
  };

  sessionStart({}, context);
  assert.ok(widgetFactory);
  const widget = widgetFactory({ requestRender: () => requestRenderCount++ }, {
    fg: (color, text) => {
      renderedColors.push(color);
      return text;
    },
  });

  await command.handler("off", context);
  assert.deepEqual(widget.render(80), []);
  assert.deepEqual(appended.at(-1), {
    customType: MASCOT_PREFERENCES_TYPE,
    data: { enabled: false, showLabel: true, gap: 2 },
  });

  await command.handler("label off extra", context);
  assert.equal(notifications.at(-1)?.type, "error");
  await command.handler("gap 9", context);
  assert.equal(notifications.at(-1)?.type, "error");
  await command.handler("unknown", context);
  assert.equal(notifications.at(-1)?.type, "error");
  assert.equal(notifications.at(-1)?.message, MASCOT_USAGE);
  await command.handler("on", context);
  const appendedAfterOn = appended.length;
  const redrawsAfterOn = requestRenderCount;
  await command.handler("on", context);
  assert.equal(appended.length, appendedAfterOn);
  assert.equal(requestRenderCount, redrawsAfterOn);
  await command.handler("label off", context);
  await command.handler("gap 6", context);
  assert.equal(requestRenderCount, 4);
  assert.equal(widgetInstallCount, 1);
  assert.deepEqual(widget.render(80), [
    ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}`,
    MASCOT_ART[1],
    `  ${MASCOT_ART[2]}  `,
  ]);
  assert.ok(renderedColors.every((color) => color === "accent"));

  await command.handler("status", context);
  assert.equal(
    notifications.at(-1)?.message,
    "Mascot: enabled; PI CODE label: disabled; Gap: 6; State: idle",
  );

  await command.handler("help", context);
  assert.equal(notifications.at(-1)?.message, MASCOT_HELP);

  await command.handler("reset", context);
  assert.equal(notifications.at(-1)?.message, "Mascot settings reset");
  assert.deepEqual(appended.at(-1), {
    customType: MASCOT_PREFERENCES_TYPE,
    data: { enabled: true, showLabel: false, gap: 2 },
  });
  assert.equal(requestRenderCount, 5);

  events.get("agent_start")?.({}, context);
  renderedColors.length = 0;
  assert.equal(widget.render(80)[0], ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}`);
  assert.ok(renderedColors.every((color) => color === "thinkingText"));
  events.get("tool_execution_start")?.({}, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.ok(renderedColors.every((color) => color === "warning"));
  events.get("tool_execution_end")?.({ isError: true }, context);
  events.get("agent_end")?.({}, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.ok(renderedColors.every((color) => color === "error"));
  await command.handler("status", context);
  assert.equal(notifications.at(-1)?.message, "Mascot: enabled; PI CODE label: disabled; Gap: 2; State: error");

  widget.dispose?.();
  sessionStart({}, {
    ...context,
    sessionManager: {
      getBranch: () => appended.map(({ customType, data }) => ({ type: "custom", customType, data })),
    },
  });
  assert.ok(widgetFactory);
  const restoredWidget = widgetFactory({ requestRender: () => requestRenderCount++ }, {
    fg: (color, text) => {
      renderedColors.push(color);
      return text;
    },
  });
  assert.deepEqual(restoredWidget.render(80), [
    ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}`,
    MASCOT_ART[1],
    `  ${MASCOT_ART[2]}  `,
  ]);
  events.get("agent_start")?.({}, context);
  events.get("agent_end")?.({}, context);
  renderedColors.length = 0;
  restoredWidget.render(80);
  assert.ok(renderedColors.every((color) => color === "success"));
  restoredWidget.dispose?.();
});
