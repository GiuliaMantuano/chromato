# chromato

**Focus in full colour** — work, break, repeat, right in your terminal.

An animated Pomodoro timer for terminal developers. Colour-gradient progress bar, phase transitions you won't miss, and seamless tmux/shell integration.

```
WORK  POMODORO 1 of 4  Today: 2 sessions
██████░░░░░░░░░░░░░░░░░░ 26%  18:34
```

## Install

Requires Node.js 22 or higher and pnpm (`corepack enable` if you don't have it). chromato isn't published on npm yet, so install it from a local clone:

```bash
git clone https://github.com/GiuliaMantuano/chromato
cd chromato
pnpm install
pnpm link:local
```

This builds the project and links `chromato` onto your PATH.

**Command not found?** pnpm needs a global bin directory on your PATH. Run `pnpm setup`, then reload your shell (`source ~/.zshrc` or `~/.bashrc`) and try again.

## Quickstart

Start a 25-minute work session with one command:

```bash
$ chromato start
```

Check what's running (completes in <200ms wall-clock, <5ms in-process):

```bash
$ chromato status
```

Press `Ctrl+C` to stop cleanly (exit code 0).

That's it. You're timing.

> **First run?** Bare `chromato` launches a quick setup wizard (theme, timing, notifications). Re-run it any time with `chromato setup`, or change settings from the home screen's **Reconfigure** option.

## Features

- **Guided setup wizard** — `chromato setup` (auto-runs on first launch) to pick your theme, timing, and notifications; a welcome-back home screen on later runs
- **Colour palettes** — `ocean`, `lavender`, `berry`, `forest` via `--palette`, `CHROMATO_PALETTE`, or the wizard
- **Animated progress bar** — Renders within 100ms, updates every second, adapts to terminal width
- **Color-coded phases** — WORK, BREAK, and LONG BREAK each render in a distinct colour drawn from your palette (OVERDUE is always a warning red), and the phase name is always shown as text alongside the colour
- **In-session controls** — `s` skips a break/overdue to the next focus block, `q` quits cleanly
- **In-terminal notifications** — an in-frame banner, terminal bell, and window-title update on phase transitions (pick from 4 modes); warm unit-aware copy + a session-complete summary; no OS notifications, no new runtime dependencies
- **Configurable durations** — Work (25m default), short break (5m), long break (15m), cycle count (4 pomodoros)
- **Minimal mode** — `--minimal` for plain-text output; no TUI, no color, no bloat
- **NO_COLOR compliant** — respects `NO_COLOR` environment variable
- **Clean shutdown** — Ctrl+C exits with code 0; no zombie processes
- **< 1% CPU steady-state** — designed for always-on terminal sessions
- **ASCII fallback** — automatic when Unicode block chars unavailable

## tmux Integration

Add this to your `~/.tmux.conf` to show session status in the status bar:

```bash
set -g status-right "#(chromato status --format tmux)"
```

The `tmux` format is optimized for narrow spaces — <200ms wall-clock, <5ms in-process, no TUI overhead.

## Shell Prompt Integration

Add to your `~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`:

**Bash/Zsh:**
```bash
PS1='$(chromato status --format prompt) $ '
```

**Fish:**
```fish
function fish_prompt
    echo -n (chromato status --format prompt)" > "
end
```

The `prompt` format is ultra-compact: shows only phase, remaining time, and current pomodoro count.

## Configuration

Flags for `chromato start`:

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--work <minutes>` | `-w` | 25 | Work duration in minutes |
| `--break <minutes>` | `-b` | 5 | Short break duration in minutes |
| `--long-break <minutes>` | `-l` | 15 | Long break duration in minutes |
| `--count <n>` | `-c` | 4 | Pomodoros per cycle before long break |
| `--palette <name>` | `-p` | ocean | Colour palette: `ocean`, `lavender`, `berry`, `forest` |
| `--minimal` | | off | Plain-text output, no TUI, no ANSI |
| `--no-color` | `-C` | off | Suppress all ANSI color (works on every command) |
| `--ascii` | | off | ASCII progress bar (`=` and `-`) |

Persist your defaults (palette, durations, notifications) with `chromato setup`, which writes `~/.config/chromato/config.json`.

Environment variables:

| Variable | Effect |
|----------|--------|
| `NO_COLOR` | Suppress all ANSI color (respects [no-color.org](https://no-color.org)) |
| `CHROMATO_PALETTE` | Override the colour palette (`ocean`, `lavender`, `berry`, `forest`) |
| `CHROMATO_WORK_SECONDS` | Override work duration in seconds (testing shortcut) |
| `CHROMATO_BREAK_SECONDS` | Override break duration in seconds (testing shortcut) |

## Minimal Mode

For environments with limited terminal support, use `--minimal`:

```bash
$ chromato start --minimal
WORK 24:35 [--------------------] 2% POMODORO 1 of 4
```

No ANSI codes, no TUI rendering — just plain text to stdout.

## Status Formats

`chromato status` supports three output formats:

```bash
$ chromato status --format plain
WORK 18:34

$ chromato status --format tmux
18:34 WORK

$ chromato status --format prompt
(P1 18:34)
```

The `tmux` format is colored with real ANSI escape codes matching the phase (not tmux `#[]` directives) — no extra styling needed in your tmux config. Combine with `--width <n>` to truncate for narrow spaces.

## NO_COLOR

chromato respects the `NO_COLOR` environment variable. Set it to suppress all ANSI color sequences across all output modes:

```bash
$ NO_COLOR=1 chromato start
```

## Documentation

- [Install & Configure](./docs/howto/install-and-configure.md) — detailed setup, config files, advanced options
- [CLI Reference](./docs/reference/cli-reference.md) — complete command and flag documentation

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Normal exit (including Ctrl+C) |
| 1 | Runtime error |
| 2 | Usage error (invalid flags) |

## License

MIT

---

> Built with [nWave](https://github.com/nwave-ai/nwave) — the AI-native software delivery framework.
