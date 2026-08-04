# Changelog

## 1.0.10 - 2026-08-04

- Consolidated mascot controls into single `/mascot` command.
- Added subcommands `label` and `gap 0-8`.
- Removed duplicate `/mascot-label` and `/mascot-gap` commands.

## 1.0.9 - 2026-08-04

- Added `/mascot` visibility toggle.
- Added `/mascot-label` toggle for fixed `PI CODE` text.
- Added `/mascot-gap 0-8` spacing control.
- Deliberately excluded custom label text.

## 1.0.8 - 2026-08-04

- Replaced generated font with supplied three-row `PI CODE` artwork.
- Matched label height exactly to mascot.

## 1.0.7 - 2026-08-04

- Widened `PI CODE` glyphs and letter spacing.
- Kept compact four-row height.

## 1.0.6 - 2026-08-04

- Reduced `PI CODE` pixel font from five rows to four.
- Preserved readable letters and block-character style.

## 1.0.5 - 2026-08-04

- Rebuilt `PI CODE` as a readable five-row pixel font.
- Centered mascot vertically beside label.
- Kept block-character style and active theme accent.

## 1.0.4 - 2026-08-04

- Replaced label glyphs with same `█` block character used by mascot.
- Kept `PI CODE` label at mascot's three-row height.

## 1.0.3 - 2026-08-04

- Added three-row ASCII `PI CODE` label beside mascot.
- Applied active Pi theme accent to mascot and label.

## 1.0.2 - 2026-08-04

- Audited extension rendering and theme color handling.
- Extracted pure mascot rendering for regression testing.
- Added tests for left alignment, fixed geometry, and theme color application.
- Added npm validation scripts and repository metadata.
