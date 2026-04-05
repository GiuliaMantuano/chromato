# Testing chromato Locally

This guide walks you through manual testing of the chromato Pomodoro timer. Each section is independent — jump to any scenario you want to verify.

---

## Setup (one time only)

**Goal**: Prepare your environment to run chromato.

1. Open Terminal and navigate to the project folder:
   ```
   cd <repo>
   ```
   ✅ You should see the command prompt return with no errors.

2. Activate Node.js v24.13.0:
   ```
   nvm use
   ```
   ✅ You should see: `Now using node v24.13.0`

   If `nvm use` fails with "command not found: nvm", run this instead:
   ```
   export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"
   ```
   ✅ No visible output is expected — the PATH is now updated.

3. Install dependencies:
   ```
   pnpm install
   ```
   ✅ You should see a list of installed packages and finish with "added X packages".

You are now ready to test. All commands below assume you are in the project folder.

---

## Quick Smoke Test

**Goal**: Verify the basic CLI works.

Run:
```
node_modules/.bin/tsx src/index.ts --version
```

✅ You should see a version number like `1.0.0` or similar.

Run:
```
node_modules/.bin/tsx src/index.ts --help
```

✅ You should see an ASCII banner, the tagline "The Pomodoro timer your terminal deserves", and a styled list of commands (`start`, `status`, `stop`) with descriptions.

---

## Watch a 6-Second Session

**Goal**: See the full Pomodoro cycle in fast-forward.

This runs a 6-second WORK phase, then transitions to BREAK. You'll see the progress bar fill in real time, then Ctrl+C to stop.

> **Note:** `CHROMATO_WORK_SECONDS=6` is a shortcut to set a very short session for testing. The `--work` flag only accepts whole minutes (1, 2, 3…), so use this env-variable trick whenever you need a session shorter than 1 minute.

```
CHROMATO_WORK_SECONDS=6 node_modules/.bin/tsx src/index.ts start
```

✅ You should see:
- ASCII art "chromato" banner in blue and cyan
- Tagline: "The Pomodoro timer your terminal deserves"
- **WORK** phase label
- Countdown timer (0:06 → 0:05 → ... → 0:00)
- Progress bar filling left-to-right (Unicode blocks `█░` or ASCII `=--`)
- **Session badge**: `POMODORO 1 of 4`

⏱️ After ~6 seconds, the phase transitions to BREAK automatically.

✅ After transition, you should see:
- Phase label changes to **BREAK**
- Timer resets to 5:00
- Progress bar resets to empty
- Session badge still shows `POMODORO 1 of 4`

Press `Ctrl+C` to quit at any time.

✅ The terminal prompt returns cleanly with exit code 0 (no error).

---

## Watch a 1-Minute Session with Color

**Goal**: See the full progress bar fill smoothly with phase colors.

```
node_modules/.bin/tsx src/index.ts start --work 1 --break 1
```

✅ You should see:
- **WORK** phase in cyan/green (color varies by terminal theme)
- Countdown from 1:00 down to 0:00
- Progress bar **gradually fills** across the full width
- After 60 seconds: automatic transition to **BREAK** in blue/indigo
- Timer resets to 1:00, progress bar resets

Press `Ctrl+C` to stop.

---

## Watch Phase Transitions (WORK → BREAK → LONG BREAK)

**Goal**: Trigger a LONG BREAK to see the 4-phase cycle.

This runs 2 Pomodoros with 5-second work/break phases so you can watch transitions quickly:

```
CHROMATO_WORK_SECONDS=5 CHROMATO_BREAK_SECONDS=3 CHROMATO_LONG_BREAK_SECONDS=6 node_modules/.bin/tsx src/index.ts start --count 2
```

✅ You should see the sequence:
1. **WORK** (5 sec) — cyan/green bar
2. **BREAK** (3 sec) — blue/indigo bar
3. **WORK** (5 sec) — cyan/green bar
4. **BREAK** (3 sec) — blue/indigo bar
5. **LONG BREAK** (6 sec) — purple/teal bar

Each phase label and timer reset at transitions. Session badge shows `POMODORO X of 2`.

Press `Ctrl+C` to stop at any point.

---

## Watch the Overdue Pulse

**Goal**: See what happens when the timer runs past zero.

This starts a 5-second work phase. When time expires, don't press Ctrl+C. The timer enters OVERDUE mode and the progress bar pulses between solid red and dim red.

```
CHROMATO_WORK_SECONDS=5 node_modules/.bin/tsx src/index.ts start
```

✅ You should see:
- **WORK** phase fills normally (5:00 → 0:00)
- At 0:00, the phase label changes to **OVERDUE**
- Progress bar fills with **red**
- Every 2 seconds, the bar **pulses**: bright red → dim red → bright red

⏱️ Wait at least 5 seconds in OVERDUE to see the pulse cycle.

Press `Ctrl+C` to stop.

---

## Test ASCII Progress Bar

**Goal**: Verify the ASCII fallback (`=` and `-` instead of Unicode blocks).

```
CHROMATO_WORK_SECONDS=6 node_modules/.bin/tsx src/index.ts start --ascii
```

✅ You should see:
- Same TUI as before
- Progress bar uses `=` (filled) and `-` (empty) instead of `█░`
- Example: `[====----]` instead of `[████░░░░]`

All other behavior is identical. Press `Ctrl+C` to stop.

---

## Test NO_COLOR Mode

**Goal**: Verify that all ANSI color is suppressed.

```
NO_COLOR=1 CHROMATO_WORK_SECONDS=6 node_modules/.bin/tsx src/index.ts start
```

✅ You should see:
- Same TUI as before
- **No colored text** — everything is plain white/default terminal color
- Phase label, timer, and progress bar are all visible (no color)
- All text and UI elements render, just without color

This is useful for accessibility and screenshots. Press `Ctrl+C` to stop.

---

## Test Minimal Mode (Plain Text Output)

**Goal**: Verify the `--minimal` flag produces plain-text output with no TUI or ANSI codes.

```
CHROMATO_WORK_SECONDS=6 node_modules/.bin/tsx src/index.ts start --minimal
```

✅ You should see:
- Plain text lines printed to stdout (no full-screen TUI)
- Each line includes phase, remaining time, and session number — e.g. `WORK 00:05 P1/4`
- No colored text — everything is plain terminal default
- No Unicode block characters

This mode is useful for piping into scripts or logging. Press `Ctrl+C` to stop.

Run with both flags together for the most constrained output:

```
CHROMATO_WORK_SECONDS=6 node_modules/.bin/tsx src/index.ts start --minimal --no-color
```

✅ Output should be identical — there are no ANSI codes in `--minimal` mode regardless.

---

## Test Compact Mode (Narrow Terminal)

**Goal**: Verify the TUI reflows when the terminal is very narrow.

1. Start a session:
   ```
   node_modules/.bin/tsx src/index.ts start
   ```

2. While it's running, drag the right edge of the Terminal window to make it narrower (less than ~40 columns wide).

✅ You should see:
- Layout **automatically compresses** when the window is narrow
- Text and progress bar remain visible but rearranged
- No crashes or error messages

Widen the window again.

✅ Layout **expands back** to normal width.

Press `Ctrl+C` to stop.

---

## Test the Status Command

**Goal**: Read the current session state (useful for tmux/shell prompt integration).

**Step 1**: Start a session in one terminal window:
```
node_modules/.bin/tsx src/index.ts start --work 1
```

Let it run (the TUI displays the countdown).

**Step 2**: Open a **second** Terminal window and navigate to the project:
```
cd <repo>
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"
```

**Step 3**: In the second window, check the plain-text status:
```
node_modules/.bin/tsx src/index.ts status --format plain
```

✅ You should see output like:
```
WORK — 0:47 remaining (POMODORO 1/4)
```

**Step 4**: In the second window, check the tmux format (compact, colored):
```
node_modules/.bin/tsx src/index.ts status --format tmux
```

✅ You should see output like:
```
#[fg=cyan]●#[default] 0:47
```

(The exact colors may vary; this is compact format for `status-right`.)

**Step 5**: Wait a few seconds, then run the status command again in the second window:
```
node_modules/.bin/tsx src/index.ts status --format plain
```

✅ The timer should have counted down (e.g., now `0:42` instead of `0:47`). This confirms the status reads the live session state.

Return to the first window and press `Ctrl+C` to stop.

---

## Run the Automated Test Suite

**Goal**: Verify all unit, integration, and acceptance tests pass.

```
node node_modules/vitest/vitest.mjs run
```

✅ You should see test output with all tests passing. The acceptance test suite (BDD) runs separately:

```
pnpm test:acceptance
```

Or if pnpm is not on PATH:
```
node node_modules/@cucumber/cucumber/bin/cucumber.js --config cucumber.config.mjs
```

✅ All 68 scenarios across milestones 1–7 should pass (405 steps, ~2m40s).

---

## Common Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| `error: option '--work' must be a positive integer` | `--work` only accepts whole minutes (1, 2, 3…) | Use `CHROMATO_WORK_SECONDS=6` instead for short tests |
| `zsh: no such file or directory: node_modules/.bin/tsx` | Not in project folder | Run `cd <repo>` first |
| `command not found: nvm` | nvm not in current shell session | Run `export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"` |
| Progress bar shows `=---` instead of `█░` | ASCII fallback (TERM or locale setting) | Run with `--ascii` to confirm fallback is working, or ignore |
| Screen blank after `Ctrl+C` | Ink clears terminal on exit | Normal — your prompt will return |
| Timer not counting down | You may be seeing a cached render | Press `Ctrl+C` and start again |

---

## Tips for Effective Testing

- **Copy-paste the commands**: All commands are ready to paste directly into Terminal. No placeholders.
- **Use the environment variables**: Env vars like `CHROMATO_WORK_SECONDS` are the fastest way to test phase transitions without waiting.
- **Open two terminals**: The status command tests are easiest with one terminal running the session and a second running status queries.
- **Watch the bar fill**: The progress bar is the most visible sign the timer is running. If it doesn't move, something is wrong.
- **Ctrl+C always works**: The only key that does something. `q`, `p`, and `s` are not implemented yet.

---

## Next Steps

- **Run all sections** to verify the feature is working end-to-end.
- **Report any crashes or unexpected output** to the development team.
- **If tests fail** beyond the known `better-sqlite3` issue, investigate further.
