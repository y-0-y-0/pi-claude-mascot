import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerMascot from "../extensions/mascot-widget.ts";
import { MASCOT_ART, PI_CODE_ART, renderMascot } from "../extensions/mascot-widget.ts";

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
    fg: (_color, text) => text,
  });
  assert.deepEqual(widget.render(80), [
    ` ${MASCOT_ART[0]}   ${PI_CODE_ART[0]}`,
    `${MASCOT_ART[1]}  ${PI_CODE_ART[1]}`,
    `  ${MASCOT_ART[2]}    ${PI_CODE_ART[2]}`,
  ]);
  assert.doesNotThrow(() => widget.invalidate());
});

test("renders mascot left-aligned with stable pixel geometry", () => {
  const lines = renderMascot((text) => text);

  assert.deepEqual(lines, [
    ` ${MASCOT_ART[0]}   ${PI_CODE_ART[0]}`,
    `${MASCOT_ART[1]}  ${PI_CODE_ART[1]}`,
    `  ${MASCOT_ART[2]}    ${PI_CODE_ART[2]}`,
  ]);
  assert.equal(PI_CODE_ART.length, 3);
  assert.deepEqual(lines.map((line) => line.length), [47, 47, 47]);
});

test("applies active theme colorizer to every mascot row", () => {
  const terracotta = renderMascot((text) => `<terracotta>${text}</terracotta>`);
  const blue = renderMascot((text) => `<blue>${text}</blue>`);

  assert.notDeepEqual(terracotta, blue);
  assert.equal(
    terracotta[0],
    ` <terracotta>${MASCOT_ART[0]}</terracotta>   <terracotta>${PI_CODE_ART[0]}</terracotta>`,
  );
  assert.equal(
    terracotta[1],
    `<terracotta>${MASCOT_ART[1]}</terracotta>  <terracotta>${PI_CODE_ART[1]}</terracotta>`,
  );
  assert.equal(
    terracotta[2],
    `  <terracotta>${MASCOT_ART[2]}</terracotta>    <terracotta>${PI_CODE_ART[2]}</terracotta>`,
  );
});
