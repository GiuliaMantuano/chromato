# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-07

### Added

- Animated progress bar — Unicode block characters, updates every second, adapts to terminal width
- Color-coded phases: WORK (cyan/green), BREAK (blue/indigo), LONG_BREAK (purple), OVERDUE (red pulsing)
- Phase-matched progress bar colors — bar color changes with the active phase
- Progress bar fill accuracy — fraction-based fill calculation, not integer-rounded
- 1-second progress bar update cadence — drift-corrected tick loop
- tmux status-right integration via `chromato status --format tmux`
- Shell prompt integration via `chromato status --format prompt` and `--format plain`
- Minimal mode (`--minimal` flag) — plain-text stdout output, no TUI, no ANSI
- NO_COLOR environment variable support (respects no-color.org standard)
- Narrow terminal compact mode — layout adapts automatically at fewer than 30 columns
- ASCII progress bar fallback (`--ascii` flag, auto-detected for `TERM=dumb`)
- Help splash screen — ASCII banner, tagline, and command list shown when `chromato` is run with no arguments
- Interactive first-run setup wizard (`chromato setup`) — a guided Ink TUI to choose your colour theme, timing, and notifications
- Welcome-back home screen — running bare `chromato` with a saved config shows a recap plus a Start / Reconfigure / Quit menu (instead of the help dump)
- Configurable colour palettes — `ocean` (default), `lavender`, `berry`, `forest` — via the wizard, the `--palette` flag, or `CHROMATO_PALETTE`
- In-session keyboard controls — `s` skips a break or overdue straight to the next focus block; `q` quits cleanly
- 4-mode in-terminal notification system (`banner` / `banner+bell` / `bell` / `off`, default `banner+bell`) — an in-frame banner, a single terminal bell, and a window-title update on phase transitions, with no new runtime dependencies
- Second overdue notification fires at +1:00 elapsed overdue
- Session-complete notification reporting focused minutes
- Persisted configuration in `config.json` (written by the wizard) supplying your defaults for bare `chromato` and `chromato start`
- Redesigned launch banner with the "Focus in full colour" tagline
