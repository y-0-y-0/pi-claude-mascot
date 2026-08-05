# pi-claude-mascot

Theme-aware pixel-art mascot widget for [Pi](https://pi.dev/). Displays small mascot above editor, aligned left.

## Install

```bash
pi install npm:pi-claude-mascot
```

Test local package before publishing:

```bash
pi --no-extensions -e ./extensions/mascot-widget.ts
```

## Mascot

Mascot and supplied `PI CODE` artwork render side by side at the same three-row height whenever the fixed artwork fits the terminal.

```text
 ▐▛███▜▌·  ██▀█▄ ██   ▄████ ▄███▄ ████▄ ██▀▀▀
▝▜█████▛▘  ██▀▀  ██   ██▄▄▄ ██▄██ ██▄██ ██▀▀
  ▘▘ ▝▝    ▀▀    ▀▀    ▀▀▀▀  ▀▀▀  ▀▀▀▀  ▀▀▀▀▀
```

Mascot keeps fixed pixel geometry beside supplied three-row `PI CODE` artwork. Both use matching block characters, with no crop. Example below shows label visible and idle sparkle `·`.

Mascot displays a sparkle immediately after its first row. It stays on `·` when idle, after success, or after error. It cycles through `· ✢ ✶ ✻ ✽ ✻ ✶ ✢ ·` every 200 ms only while Pi is thinking or executing work. Animation uses the existing widget and is cleaned up when Pi disposes it.

The artwork never wraps or crops. If the terminal is narrower than the current fixed layout, the complete widget hides until enough width is available. With the label hidden, the mascot can still render in a narrow terminal.

Pi's default `Working...` message is replaced by the complete witty phrase list vendored from [Gemini CLI's `wittyPhrases.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/ui/constants/wittyPhrases.ts). A new phrase appears every 2.5 seconds while an agent run is active; the timer stops when Pi settles the run. The package does not depend on a local Gemini CLI installation.

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

Settings are persisted globally in `~/.pi/agent/pi-claude-mascot.json`, so they survive new Pi sessions. A valid preference in the current session branch takes priority, including after `/tree` navigation. Set `PI_CLAUDE_MASCOT_PREFERENCES_PATH` to an absolute or `~/` path to override global storage for managed environments or tests. Files larger than 4 KiB and non-regular files are ignored. If global storage is unavailable, the session preference is kept and Pi shows one warning.

## Dynamic state

Mascot color follows current Pi semantic theme color for its runtime state:

- `accent` when idle;
- `thinkingText` while Pi is thinking;
- `warning` while a tool executes;
- `success` after a successful settled agent run;
- `error` after a failed settled tool or agent run.

State changes refresh the existing widget in place. Final success/error waits for Pi's `agent_settled` event, so automatic retries, compaction retries, and queued follow-ups do not produce a premature final badge. Mascot geometry and fixed three-row layout remain unchanged.

## Theme-aware color

Mascot uses semantic Pi colors through `theme.fg(color, text)`. Color is recalculated during rendering, so mascot follows active Pi theme without hardcoded ANSI escapes or hex colors.

Background remains transparent. Rendering uses plain Unicode block characters and works in universal terminals.

## Development

Requires Node.js 22.6+, matching the minimum version that supports the native TypeScript test runner flag used by this package.

```bash
npm ci
npm test
npm run typecheck
npm run pack:check
npm run pack:smoke
```

Use `--no-extensions` when testing the local extension so an installed global copy cannot register the same widget a second time. Use interactive Pi for visual validation:

```bash
pi --no-extensions -e ./extensions/mascot-widget.ts
```

Use print mode only as a non-interactive loading smoke test:

```bash
pi --no-extensions -e ./extensions/mascot-widget.ts -p ""
```

The extension has no runtime dependencies. CI audits runtime dependencies with `npm audit --omit=dev --omit=peer`; vulnerabilities in the Pi development peer are inherited from the Pi host and must be fixed by a Pi release.

Reference image: https://x.com/EricBuess/status/1973392076550123946

## Publish

```bash
npm login
npm publish --access public
```

Package publication runs tests, typecheck, package validation, and the packed-artifact smoke test through `prepublishOnly`. The Pi host is a peer dependency; keep Pi updated independently when its dependency audit reports host vulnerabilities.

After publishing, verify that npm serves the package version in `package.json`:

```bash
npm run release:verify
```
