# pi-claude-mascot

Theme-aware pixel-art mascot widget for [Pi](https://pi.dev/). Displays small mascot above editor, aligned left.

## Install

```bash
pi install npm:pi-claude-mascot
```

Test local package before publishing:

```bash
pi -e ./extensions/mascot-widget.ts
```

## Mascot

```text
 ▐▛███▜▌   ███  ███   ███  ███  ██   ████
▝▜█████▛▘  █  █  █    █    █  █ █  █ ██
  ▘▘ ▝▝    ███  ███   ███  ███  ██   ████
```

Mascot keeps fixed 9-column pixel geometry. Three-row ASCII label `PI CODE` appears beside it, with no crop or animation.

## Theme-aware color

Mascot uses semantic Pi color `accent` through `theme.fg("accent", text)`. Color is recalculated during rendering, so mascot follows active Pi theme without hardcoded ANSI escapes or hex colors.

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
