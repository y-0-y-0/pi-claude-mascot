# pi-claude-mascot

Theme-aware pixel-art mascot widget for [Pi](https://pi.dev/). Displays small mascot above editor, aligned left, with one empty line of top spacing.

## Install

```bash
pi install npm:pi-claude-mascot
```

Test local package before publishing:

```bash
pi -e ./extensions/mascot-widget.ts
```

## Mascot

Widget leaves one empty line above mascot so it sits one terminal row lower without changing artwork geometry or sparkle animation.

```text

 ▐▛███▜▌·  ▄▄▄▄  ▄▄    ▄▄▄▄  ▄▄▄  ▄▄▄▄  ▄▄▄▄▄
▝▜█████▛▘  ██▄█▀ ██   ██▀▀▀ ██▀██ ██▀██ ██▄▄
  ▘▘ ▝▝    ██    ██   ▀████ ▀███▀ ████▀ ██▄▄▄
```

Mascot keeps fixed pixel geometry beside supplied three-row `PI CODE` artwork. Both use matching block characters, with no crop. Example below shows label visible and idle sparkle `·`.

Mascot displays a sparkle immediately after its first row. It stays on `·` when idle, after success, or after error. It cycles through `· ✢ ✶ ✻ ✽ ✻ ✶ ✢ ·` every 120 ms only while Pi is thinking or executing work. Animation uses the existing widget and is cleaned up when Pi disposes it.

## Commands

```text
/mascot             Toggle mascot
/mascot on          Enable mascot
/mascot off         Disable mascot
/mascot label       Toggle PI CODE label
/mascot label on    Show PI CODE label
/mascot label off   Hide PI CODE label
/mascot gap 0-8     Set spacing between mascot and label
/mascot status      Show current mascot settings and state
/mascot reset       Restore default settings
/mascot help        Show command help
```

Custom label text is intentionally not supported.

Repeated commands with no setting change do not create duplicate session preference entries or trigger unnecessary widget redraws.

`/mascot reset` enables mascot, hides `PI CODE`, and restores gap `2`.

A fresh session without saved preferences starts with `PI CODE` visible. Reset intentionally uses quieter defaults and hides it.

Settings are persisted globally in `~/.pi/agent/pi-claude-mascot.json`, so they survive new Pi sessions. A valid preference in the current session branch takes priority. Set `PI_CLAUDE_MASCOT_PREFERENCES_PATH` to override global file path for managed environments or tests.

## Dynamic state

Mascot color follows current Pi semantic theme color for its runtime state:

- `accent` when idle;
- `thinkingText` while Pi is thinking;
- `warning` while a tool executes;
- `success` after a successful agent run;
- `error` after a failed tool or agent run.

State changes refresh the existing widget in place. Mascot geometry and fixed three-row layout remain unchanged.

## Theme-aware color

Mascot uses semantic Pi colors through `theme.fg(color, text)`. Color is recalculated during rendering, so mascot follows active Pi theme without hardcoded ANSI escapes or hex colors.

Background remains transparent. Rendering uses plain Unicode block characters and works in universal terminals.

## Development

Requires Node.js 22+, matching current Pi runtime.

```bash
npm test
npm run pack:check
pi -e ./extensions/mascot-widget.ts -p ""
```

Reference image: https://x.com/EricBuess/status/1973392076550123946

## Publish

```bash
npm login
npm publish
```

Package manifest follows Pi package conventions and exposes `extensions/` through the `pi` field in `package.json`.
