# Changelog

## 1.9.3 - 2026-08-04

- Applied a complete half-cell upward translation to the `PI CODE` pixel pattern.
- Kept npm publication separate for manual release by the package owner.

## 1.9.2 - 2026-08-04

- Raised the first `PI CODE` row by one half-cell with upper block glyphs for visual alignment.
- Kept npm publication separate for manual release by the package owner.

## 1.9.1 - 2026-08-04

- Republished the aligned three-row mascot widget release with the corrected package version.
- Kept isolated local Pi validation documented to prevent duplicate global extension widgets.

## 1.9.0 - 2026-08-04

- Removed the extra top-padding row from widget output.
- Kept mascot and `PI CODE` artwork aligned side by side at the same three-row height.
- Updated rendering regression coverage for the exact three-row output.
- Documented isolated local Pi launches to prevent duplicate global extension widgets.

## 1.8.1 - 2026-08-04

- Moved widget output one terminal row lower with one blank top-padding line.
- Kept sparkle animation, fixed artwork geometry, and hidden-state output unchanged.
- Hardened global preference writes with exclusive random temporary files and restrictive permissions.
- Fixed parallel tool state tracking so an early failure cannot be overwritten by a later success.
- Marked provider/API agent failures and aborts as mascot errors instead of false successes.
- Preference writes clean up temporary files after partial-write failures.

## 1.8.0 - 2026-08-04

- Replaced `PI CODE` artwork with compact supplied three-row Unicode artwork.
- Updated geometry regression expectations for new label width.

## 1.7.0 - 2026-08-04

- Added global preference persistence across new Pi sessions.
- Store mascot settings in `~/.pi/agent/pi-claude-mascot.json`.
- Keep valid current-session branch preference as higher-priority override.
- Added atomic preference writes, malformed-file tolerance, and cross-session regression coverage.

## 1.6.0 - 2026-08-04

- Changed `/mascot reset` defaults to hide the `PI CODE` label.
- Reset now restores `enabled=true`, `showLabel=false`, and `gap=2`.
- Added regression coverage for hidden label after reset and session restoration.

## 1.5.0 - 2026-08-04

- Limited sparkle animation to active `thinking` and `working` states.
- Kept sparkle fixed at `·` while idle, after success, and after error.
- Added state-aware timer start/stop regression coverage.

## 1.4.0 - 2026-08-04

- Added animated sparkle after mascot first row.
- Added exact sparkle sequence `· ✢ ✶ ✻ ✽ ✻ ✶ ✢ ·` at 120 ms intervals.
- Added timer cleanup through widget `dispose()` and detached timer for non-interactive runs.
- Added sparkle rendering and lifecycle regression tests.

## 1.3.0 - 2026-08-04

- Added `/mascot reset` and `/mascot help`.
- Extracted strict command parsing into exported `parseMascotCommand()`.
- Avoided redundant preference persistence and widget redraws when values are unchanged.
- Added parser and command deduplication regression tests.

## 1.2.0 - 2026-08-04

- Added strict `/mascot` controls: `on`, `off`, `label on`, `label off`, `gap`, and `status`.
- Added session-branch persistence for mascot visibility, label visibility, and gap.
- Added dynamic mascot states for thinking, tool execution, success, and error, using semantic Pi theme colors.
- Widget now updates through `tui.requestRender()` without reinstalling on each setting change.
- Added command, persistence, and state transition regression tests.

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
