# pi-claude-mascot

Pixel-art mascot widget for [Pi](https://pi.dev/). Displays small mascot above editor, aligned left. Mascot color adapts automatically to active Pi theme.

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
▐▛███▜▌
▝▜█████▛▘
  ▘▘ ▝▝
```

## Theme-aware color

Mascot uses semantic Pi color `accent` through `theme.fg("accent", text)`. No hardcoded ANSI escape or hex color. Switching Pi theme automatically changes mascot color on next render.

Rendering stays compatible with universal terminals.

Reference image: https://x.com/EricBuess/status/1973392076550123946

## Publish

```bash
npm login
npm publish
```

Package manifest follows Pi package conventions and exposes `extensions/` through the `pi` field in `package.json`.
