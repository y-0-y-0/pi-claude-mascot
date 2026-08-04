# Changelog

## 1.1.2 - 2026-08-04

- Hid mascot below its 9-column minimum width to prevent terminal truncation and deformation.

## 1.1.1 - 2026-08-04

- Reverted narrow-terminal cropping.
- Preserved mascot geometry for supported terminal widths.

## 1.1.0 - 2026-08-04

- Made mascot rendering theme-aware through Pi semantic `accent` color.
- Preserved right alignment at normal terminal widths.
- Added narrow-width and invalid-width rendering tests.
- Added unit tests for alignment, colorization, and theme styling.
- Added npm test and package validation scripts.
