import { strict as assert } from "node:assert";
import { test } from "node:test";

import { MASCOT_ART, renderMascot } from "../extensions/mascot-widget.ts";

test("keeps mascot aligned to the right at normal width", () => {
  const lines = renderMascot(20, (text) => `<accent>${text}</accent>`);

  assert.equal(lines.length, 3);
  assert.equal(lines[0], `           <accent>${MASCOT_ART[0]}  </accent>`);
  assert.equal(lines[1], `           <accent>${MASCOT_ART[1]}</accent>`);
  assert.equal(lines[2], `           <accent>${MASCOT_ART[2]}  </accent>`);
});

test("hides mascot instead of deforming it on narrow terminals", () => {
  assert.deepEqual(renderMascot(8, (text) => text), []);
  assert.deepEqual(renderMascot(5, (text) => text), []);
});

test("hides mascot for zero or invalid width", () => {
  assert.deepEqual(renderMascot(0, (text) => text), []);
  assert.deepEqual(renderMascot(Number.NaN, (text) => text), []);
  assert.deepEqual(renderMascot(-10, (text) => text), []);
});

test("applies colorizer to mascot pixels without hardcoded color", () => {
  const colored = renderMascot(9, (text) => `COLOR(${text})`);

  assert.equal(colored[0], `COLOR(${MASCOT_ART[0]}  )`);
  assert.equal(colored[1], `COLOR(${MASCOT_ART[1]})`);
  assert.equal(colored[2], `COLOR(${MASCOT_ART[2]}  )`);
});
