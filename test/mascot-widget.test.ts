import { strict as assert } from "node:assert";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { after, beforeEach, test } from "node:test";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerMascot, {
  MASCOT_ART,
  MASCOT_GLOBAL_PREFERENCES_ENV,
  MASCOT_HELP,
  MASCOT_MAX_GLOBAL_PREFERENCES_BYTES,
  MASCOT_PREFERENCES_TYPE,
  MASCOT_SPARKLE_FRAMES,
  MASCOT_SPARKLE_INTERVAL_MS,
  MASCOT_USAGE,
  MASCOT_STATE_COLORS,
  PI_CODE_ART,
  WITTY_LOADING_PHRASES_INTERVAL_MS,
  formatMascotStatus,
  getMascotArgumentCompletions,
  getGlobalPreferencesPath,
  getMascotRenderWidth,
  isMascotAnimatedState,
  isMascotPreferences,
  normalizeGap,
  parseMascotCommand,
  renderMascot,
  readGlobalPreferences,
  writeGlobalPreferences,
} from "../extensions/mascot-widget.ts";
import { WITTY_LOADING_PHRASES } from "../extensions/witty-phrases.ts";

const TEST_GLOBAL_PREFERENCES_DIRECTORY = mkdtempSync(join(tmpdir(), "pi-claude-mascot-test-"));
const TEST_GLOBAL_PREFERENCES_PATH = join(TEST_GLOBAL_PREFERENCES_DIRECTORY, "preferences.json");
const ORIGINAL_GLOBAL_PREFERENCES_PATH = process.env[MASCOT_GLOBAL_PREFERENCES_ENV];
process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = TEST_GLOBAL_PREFERENCES_PATH;
beforeEach(() => {
  rmSync(TEST_GLOBAL_PREFERENCES_PATH, { force: true });
});
after(() => {
  if (ORIGINAL_GLOBAL_PREFERENCES_PATH === undefined) delete process.env[MASCOT_GLOBAL_PREFERENCES_ENV];
  else process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = ORIGINAL_GLOBAL_PREFERENCES_PATH;
  rmSync(TEST_GLOBAL_PREFERENCES_DIRECTORY, { recursive: true, force: true });
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
    setWorkingMessage?(message: string): void;
  };
  sessionManager: {
    getBranch(): Array<{ type: string; customType?: string; data?: unknown }>;
  };
};

type MascotHandler = (event: unknown, context: MascotContext) => void;

type CommandDefinition = {
  getArgumentCompletions?(prefix: string): Array<{ value: string; label: string; description?: string }> | null;
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
  assert.ok(events.has("agent_settled"));
  assert.ok(events.has("session_tree"));
});

test("hides the complete widget when fixed artwork cannot fit the terminal width", () => {
  let sessionStart: MascotHandler | undefined;
  let widgetFactory: ((tui: { requestRender(): void }, theme: MascotTheme) => MascotWidget) | undefined;
  const pi = {
    registerCommand(): void {},
    appendEntry(): void {},
    on(event: string, handler: MascotHandler): void {
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
  const widget = widgetFactory({ requestRender(): void {} }, { fg: (_color, text) => text });
  assert.deepEqual(widget.render(44), []);
  assert.deepEqual(widget.render(45), EXPECTED_LINES);
  widget.dispose?.();
});

test("replaces Pi's working message with every vendored witty phrase", (testContext) => {
  let sessionStart: MascotHandler | undefined;
  const events = new Map<string, MascotHandler>();
  const workingMessages: string[] = [];
  const pi = {
    registerCommand(): void {},
    on(event: string, handler: MascotHandler): void {
      events.set(event, handler);
      if (event === "session_start") sessionStart = handler;
    },
  } as unknown as ExtensionAPI;
  const context: MascotContext = {
    ui: {
      setWidget(): void {},
      notify(): void {},
      setWorkingMessage(message): void {
        workingMessages.push(message);
      },
    },
    sessionManager: { getBranch: () => [] },
  };

  assert.ok(WITTY_LOADING_PHRASES.length > 100);
  assert.equal(WITTY_LOADING_PHRASES[0], "I'm Feeling Lucky");
  assert.equal(WITTY_LOADING_PHRASES.at(-1), "Pushing the button, Frank.");
  assert.equal(WITTY_LOADING_PHRASES_INTERVAL_MS, 2500);

  registerMascot(pi);
  sessionStart?.({}, context);
  assert.deepEqual(workingMessages, [WITTY_LOADING_PHRASES[0]]);

  testContext.mock.timers.enable({ apis: ["setInterval"] });
  try {
    events.get("agent_start")?.({}, context);
    testContext.mock.timers.tick(WITTY_LOADING_PHRASES_INTERVAL_MS);
    testContext.mock.timers.tick(WITTY_LOADING_PHRASES_INTERVAL_MS);
    assert.deepEqual(workingMessages, [
      WITTY_LOADING_PHRASES[0],
      WITTY_LOADING_PHRASES[1],
      WITTY_LOADING_PHRASES[2],
    ]);

    events.get("agent_end")?.({}, context);
    events.get("agent_settled")?.({}, context);
    const messagesAfterSettled = workingMessages.length;
    testContext.mock.timers.tick(WITTY_LOADING_PHRASES_INTERVAL_MS);
    assert.equal(workingMessages.length, messagesAfterSettled);

    events.get("agent_start")?.({}, context);
    assert.equal(workingMessages.at(-1), WITTY_LOADING_PHRASES[0]);
    events.get("agent_end")?.({}, context);
    events.get("agent_settled")?.({}, context);
  } finally {
    events.get("session_shutdown")?.({}, context);
    testContext.mock.timers.reset();
  }
});

test("restores branch-specific preferences after session tree navigation", () => {
  let sessionStart: MascotHandler | undefined;
  let widgetFactory: ((tui: { requestRender(): void }, theme: MascotTheme) => MascotWidget) | undefined;
  let requestRenderCount = 0;
  let branch: Array<{ type: string; customType?: string; data?: unknown }> = [
    {
      type: "custom",
      customType: MASCOT_PREFERENCES_TYPE,
      data: { enabled: true, showLabel: false, gap: 2 },
    },
  ];
  const events = new Map<string, MascotHandler>();
  const pi = {
    registerCommand(): void {},
    appendEntry(): void {},
    on(event: string, handler: MascotHandler): void {
      events.set(event, handler);
      if (event === "session_start") sessionStart = handler;
    },
  } as unknown as ExtensionAPI;

  registerMascot(pi);
  const context: MascotContext = {
    ui: {
      setWidget(_key, factory): void {
        widgetFactory = factory;
      },
      notify(): void {},
    },
    sessionManager: { getBranch: () => branch },
  };

  sessionStart?.({}, context);
  assert.ok(widgetFactory);
  const widget = widgetFactory({ requestRender: () => requestRenderCount++ }, { fg: (_color, text) => text });
  assert.deepEqual(widget.render(80), [
    ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}`,
    MASCOT_ART[1],
    `  ${MASCOT_ART[2]}  `,
  ]);

  branch = [
    {
      type: "custom",
      customType: MASCOT_PREFERENCES_TYPE,
      data: { enabled: true, showLabel: true, gap: 4 },
    },
  ];
  events.get("session_tree")?.({}, context);
  assert.equal(requestRenderCount, 1);
  assert.deepEqual(widget.render(80), [
    ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}    ${PI_CODE_ART[0]}`,
    `${MASCOT_ART[1]}    ${PI_CODE_ART[1]}`,
    `  ${MASCOT_ART[2]}      ${PI_CODE_ART[2]}`,
  ]);
  widget.dispose?.();
});

test("renders supplied three-row PI CODE artwork beside mascot at matching height", () => {
  const lines = renderMascot((text) => text);

  assert.deepEqual(lines, EXPECTED_LINES);
  assert.equal(lines.length, MASCOT_ART.length);
  assert.equal(MASCOT_ART.length, PI_CODE_ART.length);
  assert.equal(MASCOT_ART.length, 3);
  assert.equal(PI_CODE_ART.length, 3);
  assert.deepEqual(PI_CODE_ART, [
    "██▀█▄ ██   ▄████ ▄███▄ ████▄ ██▀▀▀",
    "██▀▀  ██   ██▄▄▄ ██▄██ ██▄██ ██▀▀",
    "▀▀    ▀▀    ▀▀▀▀  ▀▀▀  ▀▀▀▀  ▀▀▀▀▀",
  ]);
  assert.ok(PI_CODE_ART.every((line) => /^[█▄▀ ]+$/.test(line)));
  assert.deepEqual(lines.map((line) => line.length), [45, 44, 45]);

  const noLabel = renderMascot((text) => text, { showLabel: false });
  assert.deepEqual(noLabel, [
    ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}`,
    MASCOT_ART[1],
    `  ${MASCOT_ART[2]}  `,
  ]);

  const widerGap = renderMascot((text) => text, { gap: 4 });
  assert.equal(widerGap[0], ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}    ${PI_CODE_ART[0]}`);
});

test("calculates fixed render width for label and mascot-only layouts", () => {
  assert.equal(getMascotRenderWidth({ showLabel: true, gap: 2 }), 45);
  assert.equal(getMascotRenderWidth({ showLabel: true, gap: 4 }), 47);
  assert.equal(getMascotRenderWidth({ showLabel: false }), 9);
});

test("offers strict command completions for mascot controls", () => {
  assert.deepEqual(
    getMascotArgumentCompletions("label ")?.map((item) => item.value),
    ["label on", "label off"],
  );
  assert.deepEqual(
    getMascotArgumentCompletions("gap ")?.map((item) => item.value),
    ["gap 0", "gap 1", "gap 2", "gap 3", "gap 4", "gap 5", "gap 6", "gap 7", "gap 8"],
  );
  assert.equal(getMascotArgumentCompletions("unknown"), null);
});

test("renders requested sparkle frame and exposes animation timing", () => {
  assert.equal(MASCOT_SPARKLE_INTERVAL_MS, 200);
  assert.deepEqual(MASCOT_SPARKLE_FRAMES, ["·", "✢", "✶", "✻", "✽", "✻", "✶", "✢", "·"]);
  assert.equal(
    renderMascot((text) => text, { showLabel: false, sparkle: "✽" })[0],
    ` ${MASCOT_ART[0]}✽`,
  );
});

test("animates only during thinking or working states", (testContext) => {
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

  testContext.mock.timers.enable({ apis: ["setInterval"] });
  try {
    testContext.mock.timers.tick(MASCOT_SPARKLE_INTERVAL_MS);
    assert.equal(renderRequests, 0);

    events.get("agent_start")?.({}, {} as MascotContext);
    testContext.mock.timers.tick(MASCOT_SPARKLE_INTERVAL_MS);
    assert.ok(renderRequests > 0);

    events.get("agent_end")?.({}, {} as MascotContext);
    events.get("agent_settled")?.({}, {} as MascotContext);
    const requestsAfterIdle = renderRequests;
    testContext.mock.timers.tick(MASCOT_SPARKLE_INTERVAL_MS);
    assert.equal(renderRequests, requestsAfterIdle);
  } finally {
    widget.dispose?.();
    testContext.mock.timers.reset();
  }
});

test("normalizes configurable gap safely", () => {
  assert.equal(normalizeGap(4), 4);
  assert.equal(normalizeGap(-2), 0);
  assert.equal(normalizeGap(99), 8);
  assert.equal(normalizeGap(Number.NaN), 2);
});

test("uses a safe absolute fallback for relative path configuration", () => {
  const previousPath = process.env[MASCOT_GLOBAL_PREFERENCES_ENV];
  const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;

  try {
    process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = "relative/preferences.json";
    process.env.PI_CODING_AGENT_DIR = "relative-agent-directory";
    assert.equal(
      getGlobalPreferencesPath(),
      join(homedir(), ".pi", "agent", "pi-claude-mascot.json"),
    );
  } finally {
    process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = previousPath ?? TEST_GLOBAL_PREFERENCES_PATH;
    if (previousAgentDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
  }
});

test("expands home-relative preference paths", () => {
  const previousPath = process.env[MASCOT_GLOBAL_PREFERENCES_ENV];
  const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;

  try {
    process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = "~/custom-mascot/preferences.json";
    delete process.env.PI_CODING_AGENT_DIR;
    assert.equal(
      getGlobalPreferencesPath(),
      join(homedir(), "custom-mascot", "preferences.json"),
    );

    delete process.env[MASCOT_GLOBAL_PREFERENCES_ENV];
    process.env.PI_CODING_AGENT_DIR = "~/.pi-alt/agent";
    assert.equal(
      getGlobalPreferencesPath(),
      join(homedir(), ".pi-alt", "agent", "pi-claude-mascot.json"),
    );
  } finally {
    process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = previousPath ?? TEST_GLOBAL_PREFERENCES_PATH;
    if (previousAgentDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
  }
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

test("ignores malformed global preferences and keeps preference file private", () => {
  assert.equal(writeGlobalPreferences({ enabled: true, showLabel: false, gap: 2 }), true);
  assert.equal(statSync(TEST_GLOBAL_PREFERENCES_PATH).mode & 0o777, 0o600);
  const invalidPath = TEST_GLOBAL_PREFERENCES_PATH;
  process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = invalidPath;
  writeFileSync(invalidPath, "not-json", "utf8");
  assert.equal(readGlobalPreferences(invalidPath), undefined);
});

test("warns once when global preference storage is unavailable", async () => {
  const blockerPath = join(TEST_GLOBAL_PREFERENCES_DIRECTORY, "blocking-parent");
  const previousPath = process.env[MASCOT_GLOBAL_PREFERENCES_ENV];
  writeFileSync(blockerPath, "not-a-directory", "utf8");
  process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = join(blockerPath, "preferences.json");

  let command: CommandDefinition | undefined;
  const notifications: Array<{ message: string; type: "info" | "warning" | "error" | undefined }> = [];
  const pi = {
    registerCommand(_name: string, definition: CommandDefinition): void {
      command = definition;
    },
    appendEntry(): void {},
    on(): void {},
  } as unknown as ExtensionAPI;
  const context: MascotContext = {
    ui: {
      setWidget(): void {},
      notify(message, type): void {
        notifications.push({ message, type });
      },
    },
    sessionManager: { getBranch: () => [] },
  };

  try {
    registerMascot(pi);
    assert.ok(command);
    await command.handler("off", context);
    await command.handler("label off", context);
    assert.equal(notifications.filter(({ type }) => type === "warning").length, 1);
  } finally {
    process.env[MASCOT_GLOBAL_PREFERENCES_ENV] = previousPath ?? TEST_GLOBAL_PREFERENCES_PATH;
    rmSync(blockerPath, { force: true });
  }
});

test("ignores oversized, non-regular, and relative preference files", () => {
  const oversizedPath = join(TEST_GLOBAL_PREFERENCES_DIRECTORY, "oversized.json");
  writeFileSync(oversizedPath, "x".repeat(MASCOT_MAX_GLOBAL_PREFERENCES_BYTES + 1), "utf8");
  assert.equal(readGlobalPreferences(oversizedPath), undefined);
  assert.equal(readGlobalPreferences(TEST_GLOBAL_PREFERENCES_DIRECTORY), undefined);

  const relativePath = `pi-claude-mascot-relative-${process.pid}.json`;
  rmSync(relativePath, { force: true });
  assert.equal(writeGlobalPreferences({ enabled: true, showLabel: true, gap: 2 }, relativePath), false);
  assert.equal(readGlobalPreferences(relativePath), undefined);
  assert.equal(existsSync(relativePath), false);
});

test("handles strict mascot commands, persistence, and live widget updates", async () => {
  let sessionStart: MascotHandler | undefined;
  let widgetFactory: ((tui: { requestRender(): void }, theme: MascotTheme) => MascotWidget) | undefined;
  let command: CommandDefinition | undefined;
  let requestRenderCount = 0;
  let widgetInstallCount = 0;
  const renderedColors: string[] = [];
  const notifications: Array<{ message: string; type: "info" | "warning" | "error" | undefined }> = [];
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
  assert.equal(renderedColors.every((color) => color === "accent"), true);

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
  assert.equal(
    widget.render(80)[0],
    ` ${MASCOT_ART[0]}${MASCOT_SPARKLE_FRAMES[0]}`,
  );
  assert.equal(renderedColors.every((color) => color === "thinkingText"), true);
  events.get("tool_execution_start")?.({ toolCallId: "tool-1" }, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "warning"), true);
  events.get("tool_execution_end")?.({ toolCallId: "tool-1", isError: true }, context);
  events.get("agent_end")?.({}, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "thinkingText"), true);
  events.get("agent_settled")?.({}, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "error"), true);
  await command.handler("status", context);
  assert.equal(notifications.at(-1)?.message, "Mascot: enabled; PI CODE label: disabled; Gap: 2; State: error");

  events.get("agent_start")?.({}, context);
  events.get("tool_execution_start")?.({ toolCallId: "parallel-1" }, context);
  events.get("tool_execution_start")?.({ toolCallId: "parallel-2" }, context);
  events.get("tool_execution_end")?.({ toolCallId: "parallel-1", isError: true }, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "warning"), true);
  events.get("tool_execution_end")?.({ toolCallId: "parallel-2", isError: false }, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "error"), true);

  events.get("agent_start")?.({}, context);
  events.get("tool_execution_start")?.({ toolCallId: "retry" }, context);
  events.get("tool_execution_end")?.({ toolCallId: "retry", isError: true }, context);
  events.get("tool_execution_start")?.({ toolCallId: "retry" }, context);
  events.get("tool_execution_end")?.({ toolCallId: "retry", isError: false }, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "thinkingText"), true);

  events.get("agent_start")?.({}, context);
  events.get("agent_end")?.({ messages: [{ role: "assistant", stopReason: "error" }] }, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "thinkingText"), true);
  events.get("agent_settled")?.({}, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "error"), true);

  events.get("agent_start")?.({}, context);
  events.get("agent_end")?.({}, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "thinkingText"), true);
  events.get("agent_settled")?.({}, context);
  renderedColors.length = 0;
  widget.render(80);
  assert.equal(renderedColors.every((color) => color === "success"), true);

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
  events.get("agent_settled")?.({}, context);
  renderedColors.length = 0;
  restoredWidget.render(80);
  assert.equal(renderedColors.every((color) => color === "success"), true);
  restoredWidget.dispose?.();
});
