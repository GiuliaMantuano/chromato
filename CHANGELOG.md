# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-05

### Added

- Animated progress bar — Unicode block characters, updates every second, adapts to terminal width
- Color-coded phases: WORK (cyan/green), BREAK (blue/indigo), LONG_BREAK (purple), OVERDUE (red pulsing)
- Phase-matched progress bar colors — bar color changes with the active phase
- Progress bar fill accuracy — fraction-based fill calculation, not integer-rounded
- 1-second progress bar update cadence — drift-corrected tick loop
- Desktop notifications on phase transitions with terminal bell fallback
- Second overdue notification fires at +1:00 elapsed overdue
- tmux status-right integration via `chromato status --format tmux`
- Shell prompt integration via `chromato status --format prompt` and `--format plain`
- Minimal mode (`--minimal` flag) — plain-text stdout output, no TUI, no ANSI
- NO_COLOR environment variable support (respects no-color.org standard)
- Narrow terminal compact mode — layout adapts automatically at fewer than 30 columns
- ASCII progress bar fallback (`--ascii` flag, auto-detected for `TERM=dumb`)
- Help splash screen — ASCII banner, tagline, and command list shown when `chromato` is run with no arguments
