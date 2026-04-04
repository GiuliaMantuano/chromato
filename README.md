# chromato

**The Pomodoro timer your terminal deserves**

A fast, animated Pomodoro timer for terminal developers. Color-gradient progress bar, phase transitions you won't miss, and seamless tmux/shell integration.

```
chromato · POMODORO 1 of 4
████████████████░░░░░░░░  18:34 WORK
Today: 2
```

## Install

Requires Node.js 20 or higher.

```bash
npm install -g chromato
```

## Quickstart

Start a 25-minute work session with one command:

```bash
$ chromato start
```

Check what's running (completes in < 50ms):

```bash
$ chromato status
```

Press `Ctrl+C` to stop cleanly (exit code 0).

That's it. You're timing.

## Features

- **Animated progress bar** — Renders within 100ms, updates every second, adapts to terminal width
- **Color-coded phases** — Green (WORK) → Blue (BREAK) → Purple (LONG BREAK) → Red (OVERDUE)
- **Desktop notifications** — fires within 1 second of phase transition; terminal bell fallback
- **Configurable durations** — Work (25m default), short break (5m), long break (15m), cycle count (4 pomodoros)
- **Minimal mode** — `--minimal` for plain-text output; no TUI, no color, no bloat
- **NO_COLOR compliant** — respects `NO_COLOR` environment variable
- **Exit code 0 always** — Ctrl+C exits cleanly; no zombie processes
- **< 1% CPU steady-state** — designed for always-on terminal sessions
- **ASCII fallback** — automatic when Unicode block chars unavailable

## tmux Integration

Add this to your `~/.tmux.conf` to show session status in the status bar:

```bash
set -g status-right "#(chromato status --format tmux)"
```

The `tmux` format is optimized for narrow spaces (< 50ms, no TUI overhead).

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
| `--minimal` | | off | Plain-text output, no TUI, no ANSI |
| `--no-color` | | off | Suppress all ANSI color |
| `--ascii` | | off | ASCII progress bar (`=` and `-`) |

Environment variables:

| Variable | Effect |
|----------|--------|
| `NO_COLOR` | Suppress all ANSI color (respects [no-color.org](https://no-color.org)) |
| `CHROMATO_WORK_SECONDS` | Override work duration in seconds (testing shortcut) |
| `CHROMATO_BREAK_SECONDS` | Override break duration in seconds (testing shortcut) |

## Minimal Mode

For environments with limited terminal support, use `--minimal`:

```bash
$ chromato start --minimal
WORK: 24:35 (Pomodoro 1 of 4)
```

No ANSI codes, no TUI rendering — just plain text to stdout.

## Status Formats

`chromato status` supports three output formats:

```bash
$ chromato status --format plain
WORK — 18:34 remaining (POMODORO 1/4)

$ chromato status --format tmux
#[fg=cyan]● 18:34#[default]

$ chromato status --format prompt
⏱ 18:34
```

Combine with `--width <n>` to truncate for narrow spaces.

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
