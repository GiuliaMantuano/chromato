# chromato CLI Reference

Complete reference for every command, flag, environment variable, and output format in the chromato Pomodoro timer for the terminal.

---

## chromato start

Starts a Pomodoro session with automatic phase transitions through WORK → BREAK → LONG_BREAK cycles. Renders a full animated TUI with color gradient progress bar by default. Sends desktop notifications at phase transitions; falls back to terminal bell if unavailable.

### Options

| Flag | Short | Type | Default | Range | Description |
|------|-------|------|---------|-------|-------------|
| `--work <minutes>` | `-w` | positive integer | `25` | 1–1440 | Work phase duration in minutes |
| `--break <minutes>` | `-b` | positive integer | `5` | 1–1440 | Short break duration in minutes |
| `--long-break <minutes>` | `-l` | positive integer | `15` | 1–1440 | Long break duration in minutes |
| `--count <n>` | `-c` | positive integer | `4` | 1–99 | Number of Pomodoros before long break |
| `--minimal` | | boolean flag | off | | Output plain text to stdout; disables TUI and ANSI colors |
| `--ascii` | | boolean flag | off | | Force ASCII progress bar characters (`=` for filled, `-` for empty); disables auto-detection message |
| `--palette <name>` | `-p` | enum: `ocean`, `lavender`, `berry`, `forest` | `ocean` | | Colour palette for the TUI and progress bar. See [Color Palettes](#color-palettes). |
| `--no-color` | `-C` | boolean flag | off | | Suppress all ANSI color sequences (program-level — works on every command; same effect as the `NO_COLOR` environment variable). |

### TUI Output

Default mode renders a full interactive TUI with animated progress bar:

```
chromato · POMODORO 1 of 4
████████████████████░░░░  18:34 WORK
Today: 2
```

Display updates every second. Progress bar uses Unicode block characters with phase-matched color gradient (green/cyan for WORK, blue/indigo for BREAK, purple for LONG_BREAK, red pulsing for OVERDUE).

### In-Session Controls

While a session is running in the TUI, single keypresses control it. The footer advertises the keys available in the current phase:

| Key | Action | Available in |
|-----|--------|--------------|
| `s` / `S` | Skip the current phase straight to a fresh WORK session (resets the countdown, advances the Pomodoro badge, clears the overdue counter) | `BREAK`, `LONG_BREAK`, `OVERDUE` |
| `q` / `Q` | Quit cleanly (exit code 0) | every phase |
| `Ctrl+C` | Quit cleanly — works silently in every phase (not shown in the footer) | every phase |

Footer hints by phase:

- `BREAK` / `LONG_BREAK` → `S skip break · Q quit`
- `OVERDUE` → `S start work · Q quit`
- `WORK` → `Q quit` (skip is intentionally suppressed during focus)

`s` during WORK is a no-op (skipping focus is not offered). These controls apply to the TUI only; `--minimal` mode is non-interactive.

### Minimal Output

With `--minimal` flag, outputs plain text to stdout (no TUI, no ANSI):

```
WORK 24:59 P1/4
WORK 24:58 P1/4
WORK 24:57 P1/4
```

Each line contains: `<PHASE> <MM:SS> P<n>/<total>`

Updated every second. Safe to pipe to files or other programs. No color codes even if `NO_COLOR` is unset.

### Phases

| Phase | Label | Color | Trigger |
|-------|-------|-------|---------|
| WORK | `WORK` | Green/cyan gradient | Session start |
| BREAK | `BREAK` | Blue/indigo gradient | Work timer reaches 0 |
| LONG_BREAK | `LONG BREAK` | Purple gradient | After `--count` cycles completed |
| OVERDUE | `OVERDUE` | Red, pulsing | Work timer not acknowledged at 0; reactivates every 60 seconds |
| IDLE | `IDLE` | Gray | No active session |

### Notifications

A desktop notification fires within 1 second of each notable moment. Copy is warm and unit-aware (durations interpolated from your session):

| Moment | Title | Body |
|--------|-------|------|
| WORK → short break | `Pomodoro complete 🍅` | `Time for a {break}-minute break.` |
| break → WORK | `Break’s over` | `Back to focus for a {work}-minute block.` |
| WORK → long break | `{n} pomodoros done 🎉` | `Take a proper {long-break}-minute break.` |
| Overdue (break ran long) | `Break ran over` | `Ready to focus again?` |
| Session complete | `Session complete` | `{focused} min focused. Well done.` |

Delivery is platform-native and adds **no runtime dependencies**: `osascript` on macOS, `notify-send` on Linux (with a timer-ring icon), falling back to the terminal bell (`\a`) when a desktop notifier is unavailable or the session is non-interactive/headless.

Notifications honour the on/off choice made in [`chromato setup`](#chromato-setup); when off, no desktop notification is sent.

### ASCII Fallback

Automatically activates when:
- `TERM=dumb`
- `LANG` or `LC_ALL` does not contain `UTF-8`

Can be forced with `--ascii` flag. Auto-activation prints an informational message to stderr and exits with code 0 (not an error).

### Signal Handling

- **SIGINT (Ctrl+C)**: Writes IDLE state to state file, prints interrupted-session summary, exits 0
- **SIGTERM**: Equivalent to SIGINT
- **Natural completion**: All cycles complete; exits 0

---

## chromato status

Reads the active session state and outputs a formatted status string. Designed for tmux status bars, shell prompts, and scripts. Completes in under 200ms wall-clock (Node.js startup); in-process execution is under 5ms (does not load Ink or React).

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format <fmt>` | enum: `plain`, `tmux`, `prompt` | `plain` | Output format variant |
| `--width <n>` | positive integer | `20` | Maximum output length in characters |

### Output Formats

#### plain

Human-readable single-line output:

```
WORK — 18:34 remaining (POMODORO 1/4)
```

Suitable for scripts that parse session information. Always includes phase label, remaining time, and current Pomodoro position.

#### tmux

tmux-compatible color-markup output:

```
#[fg=cyan]● 18:34#[default]
```

Includes tmux color directives. Safe to use in `status-right` and `status-left`. Respects `--width` (default ≤20 characters).

#### prompt

Ultra-compact format:

```
⏱ 18:34
```

Suitable for shell prompts (`PS1`, `RPROMPT`, `fish_right_prompt`). ≤15 characters. Includes elapsed time or remaining time depending on phase.

### IDLE State

When no active session exists, all formats return an empty string (`""`) with exit code 0. No error message is printed.

### State File Freshness

The state file is updated:
- Every ≤5 seconds during an active session
- Within 500ms of phase transitions
- Within 100ms of Ctrl+C/SIGINT

---

## chromato setup

Runs the interactive first-run setup wizard. Walks through **Welcome → Theme** (with a live colour preview) **→ Timing** (the 25 · 5 × 4 default, or custom values) **→ Notifications** (on/off, plus a tmux hint when `$TMUX` is set) **→ Summary**, then writes your choices to the config file and launches the first session.

`chromato setup` always runs the wizard, regardless of whether a config already exists. It requires an interactive colour terminal; in a non-interactive context it exits without prompting.

The wizard writes [`config.json`](#configuration-file); values stored there become the defaults for bare `chromato` and `chromato start`.

---

## Running chromato with no command

Bare `chromato` (no subcommand) adapts to your state, but only in an interactive colour terminal:

| Situation | Behaviour |
|-----------|-----------|
| No config file yet | Launches the first-run setup wizard (same as `chromato setup`) |
| Config exists | Shows the **home screen**: a recap of your saved theme, timing, and notifications, plus a menu — **Start a focus session** (`Enter`), **Reconfigure…** (`R`, re-runs the wizard), **Quit** (`Q` / `Ctrl+C`) |
| Non-interactive (piped, `NO_COLOR`, `--no-color`, CI) | Prints the standard `--help` text, Ink-free |

`chromato --help` and `chromato start` always behave the same regardless of config state.

---

## chromato --version

Prints the installed version to stdout and exits 0.

```
1.0.0
```

---

## chromato --help

Prints usage summary (≤40 lines) including command syntax, flag defaults, and concrete examples. Exits 0. Respects `NO_COLOR` environment variable.

---

## Environment Variables

| Variable | Type | Description |
|----------|------|-------------|
| `NO_COLOR` | any non-empty string | Suppresses all ANSI escape sequences in all commands and output modes. Complies with [no-color.org](https://no-color.org) standard. Recognized by `chromato start`, `chromato status`, and `chromato --help`. |
| `CHROMATO_WORK_SECONDS` | positive number (decimal allowed) | Override work phase duration in seconds. Takes precedence over `--work` flag. Intended for testing short sessions. Example: `CHROMATO_WORK_SECONDS=10` for 10-second work phase. |
| `CHROMATO_BREAK_SECONDS` | positive number (decimal allowed) | Override short break duration in seconds. Takes precedence over `--break` flag. Example: `CHROMATO_BREAK_SECONDS=3` for 3-second break. |
| `CHROMATO_PALETTE` | enum: `ocean`, `lavender`, `berry`, `forest` | Override the colour palette. Takes precedence over `config.json`, but is overridden by the `--palette` flag. See [Color Palettes](#color-palettes). |
| `XDG_DATA_HOME` | directory path | Override the XDG Base Directory path for state file storage. State file is written to `$XDG_DATA_HOME/chromato/state.json`. Default: `~/.local/share` |
| `XDG_CONFIG_HOME` | directory path | Override the XDG Base Directory path for the config file. Config is read from `$XDG_CONFIG_HOME/chromato/config.json`. Default: `~/.config` |

### Resolution Order (Highest to Lowest Priority)

1. CLI flags (`--work`, `--break`, `--long-break`, `--count`, `--palette`)
2. Environment variables (`CHROMATO_WORK_SECONDS`, `CHROMATO_BREAK_SECONDS`, `CHROMATO_PALETTE`)
3. Configuration file (`config.json`, written by [`chromato setup`](#chromato-setup))
4. Hardcoded defaults (25 · 5 × 4, `ocean`)

---

## State File

### Location

`$XDG_DATA_HOME/chromato/state.json`

Default absolute path: `~/.local/share/chromato/state.json`

The directory is created automatically on first `chromato start` if it does not exist.

### Guarantees

- Written atomically (write to temporary file, then `rename(2)`)
- Always valid JSON, even during concurrent writes
- Created within 1 second of `chromato start`
- Updated every ≤5 seconds during active session

### Schema (schemaVersion: 1)

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | integer | Schema version. Currently `1`. |
| `phase` | string | Current phase: `"IDLE"`, `"WORK"`, `"BREAK"`, `"LONG_BREAK"`, or `"OVERDUE"` |
| `remainingSeconds` | number | Seconds remaining in current phase (relative to phase start time) |
| `elapsedSeconds` | number | Seconds elapsed in current phase |
| `progressFraction` | number | Progress fill fraction: 0.0 (empty) to 1.0 (complete) |
| `currentPomodoro` | integer | Current Pomodoro number within the cycle (1 to `cycleCount`) |
| `cycleCount` | integer | Total Pomodoros per cycle (from `--count` flag) |
| `completedToday` | integer | Number of sessions completed during the current calendar day (UTC) |
| `streak` | integer | Number of consecutive calendar days with ≥1 completed session |
| `isOverdue` | boolean | `true` when current time exceeds work phase end time without phase transition |
| `overdueElapsedSeconds` | number | Seconds elapsed in overdue state (0 if `isOverdue` is false) |
| `lastUpdatedUtc` | string | ISO 8601 timestamp of last state file write (example: `"2026-04-04T10:05:00.000Z"`) |

### Example

```json
{
  "schemaVersion": 1,
  "phase": "WORK",
  "remainingSeconds": 1200,
  "elapsedSeconds": 300,
  "progressFraction": 0.2,
  "currentPomodoro": 1,
  "cycleCount": 4,
  "completedToday": 2,
  "streak": 3,
  "isOverdue": false,
  "overdueElapsedSeconds": 0,
  "lastUpdatedUtc": "2026-04-04T10:05:00.000Z"
}
```

---

## Color Palettes

chromato ships four colour palettes for the TUI and progress-bar gradient:

| Name | Notes |
|------|-------|
| `ocean` | Default |
| `lavender` | |
| `berry` | |
| `forest` | |

**Resolution precedence (highest to lowest):** `--palette` flag → `CHROMATO_PALETTE` env → `config.json` (`"palette"` key) → default (`ocean`). Pick one interactively in [`chromato setup`](#chromato-setup), or set it per-run with `--palette`.

---

## Configuration File

### Location

`$XDG_CONFIG_HOME/chromato/config.json` (default `~/.config/chromato/config.json`).

Written by [`chromato setup`](#chromato-setup) (and by **Reconfigure…** on the home screen). Its values become the defaults for bare `chromato` and `chromato start`, overridable per-run by flags and environment variables (see [Resolution Order](#resolution-order-highest-to-lowest-priority)).

### Schema

Timing keys are in **minutes** (the runtime multiplies by 60). All keys are optional on read (absent → default); the wizard writes the full set.

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `palette` | string | `ocean` \| `lavender` \| `berry` \| `forest` | Colour palette |
| `work` | integer | 1–90 | Work duration (minutes) |
| `break` | integer | 1–30 | Short break duration (minutes) |
| `longBreak` | integer | 5–60 (step 5) | Long break duration (minutes) |
| `cycles` | integer | 1–8 | Pomodoros before a long break |
| `notifications` | boolean | | Whether desktop notifications are sent |

### Example

```json
{
  "palette": "ocean",
  "work": 25,
  "break": 5,
  "longBreak": 15,
  "cycles": 4,
  "notifications": true
}
```

---

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| `0` | Success | Normal exit, Ctrl+C during session, session completed all cycles, `--version`, `--help`, `status` (including IDLE state) |
| `1` | Runtime error | Unhandled exception, I/O error (e.g., permission denied writing state file), Node.js error |
| `2` | Usage error | Invalid flag value, unknown flag, invalid argument type |

---

> Built with [nWave](https://github.com/nwave-ai/nwave) — the AI-native software delivery framework.
