import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerMascot, {
  MASCOT_ART,
  PI_CODE_ART,
  renderMascot,
} from "../extensions/mascot-widget.ts";

type MascotTheme = {
  fg(color: "accent", text: string): string;
};

type MascotWidget = {
  render(width: number): string[];
  invalidate(): void;
};

type SessionStartHandler = (
  event: unknown,
  context: {
    ui: {
      setWidget(
        key: string,
        factory: (tui: unknown, theme: MascotTheme) => MascotWidget,
      ): void;
    };
  },
) => void;

const EXPECTED_LINES = [
  ` ${MASCOT_ART[0]}   ${PI_CODE_ART[0]}`,
  `${MASCOT_ART[1]}  ${PI_CODE_ART[1]}`,
  `  ${MASCOT_ART[2]}    ${PI_CODE_ART[2]}`,
];

test("registers mascot widget on session_start with default placement", () => {
  let sessionStart: SessionStartHandler | undefined;
  let widgetFactory: ((tui: unknown, theme: MascotTheme) => MascotWidget) | undefined;

  const pi = {
    on(event: string, handler: SessionStartHandler): void {
      assert.equal(event, "session_start");
      sessionStart = handler;
    },
  } as unknown as ExtensionAPI;

  registerMascot(pi);
  assert.ok(sessionStart);

  sessionStart({}, {
    ui: {
      setWidget(key, factory): void {
        assert.equal(key, "mascot");
        widgetFactory = factory;
      },
    },
  });

  assert.ok(widgetFactory);
  const widget = widgetFactory({}, {
    fg: (color, text) => {
      assert.equal(color, "accent");
      return text;
    },
  });

  assert.deepEqual(widget.render(80), EXPECTED_LINES);
  assert.doesNotThrow(() => widget.invalidate());
});

test("renders supplied three-row PI CODE artwork beside mascot", () => {
  const lines = renderMascot((text) => text);

  assert.deepEqual(lines, EXPECTED_LINES);
  assert.equal(PI_CODE_ART.length, 3);
  assert.ok(PI_CODE_ART.every((line) => /^[█▄▀ ]+$/.test(line)));
  assert.deepEqual(lines.map((line) => line.length), [50, 48, 50]);
});

test("applies active theme colorizer to mascot and every PI CODE row", () => {
  const accent = renderMascot((text) => `<accent>${text}</accent>`);
  const muted = renderMascot((text) => `<muted>${text}</muted>`);

  assert.notDeepEqual(accent, muted);
  assert.equal(accent.length, 3);
  assert.ok(accent.every((line) => line.includes("<accent>")));
  assert.ok(accent.every((line) => !line.includes("<muted>")));
});
