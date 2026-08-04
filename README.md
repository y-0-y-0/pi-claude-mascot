# pi-claude-mascot

Theme-aware pixel-art mascot widget for [Pi](https://pi.dev/). Mascot renders above the editor and stays aligned to the right edge.

## Install

```bash
pi install npm:pi-claude-mascot
```

Test local extension before publishing:

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

Mascot pixels use Pi semantic color `accent` through `theme.fg("accent", text)`. Color is recalculated during rendering, so mascot follows active theme without hardcoded ANSI escapes or hex colors.

Background remains transparent. Rendering uses plain Unicode block characters and works in universal terminals.

## Layout behavior

- Terminals at least 9 columns wide: mascot is aligned to the right edge.
- Narrow terminals: left padding clamps to zero and mascot drawing stays unchanged.
- Zero, negative, or invalid width: mascot drawing stays visible without extra padding.

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
