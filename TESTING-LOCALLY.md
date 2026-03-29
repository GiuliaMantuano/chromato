# Testing chromato locally — step by step

Guide to follow at each iteration to test chromato on macOS terminal.

---

## Prerequisites (one-time setup)

Verify nvm is installed:
```bash
nvm --version
```
If not found, install from https://github.com/nvm-sh/nvm.

---

## Standard procedure (every iteration)

### Step 1 — Open a new terminal

Open Terminal.app or iTerm2 (not the Claude Code chat).

### Step 2 — Navigate to the project folder

```bash
cd <repo>
```

### Step 3 — Activate the correct Node version

```bash
nvm use
```

Expected output: `Now using node v24.13.0`

If nvm is not in PATH, use the fallback:
```bash
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"
```

### Step 4 — Launch chromato

Short session (6 seconds) to see banner + progress bar:
```bash
node_modules/.bin/tsx src/index.ts start --work 0.1
```

Standard 25-minute session:
```bash
node_modules/.bin/tsx src/index.ts start
```

Custom parameters:
```bash
node_modules/.bin/tsx src/index.ts start --work 1 --break 1 --cycles 2
```

Without colors (test NO_COLOR fallback):
```bash
NO_COLOR=1 node_modules/.bin/tsx src/index.ts start --work 0.1
```

### Step 5 — Interact with the TUI

| Key      | Action |
|----------|--------|
| `Ctrl+C` | Quit   |

> Keys `q`, `p`, `s`, `?` are planned but not yet implemented.

### Step 6 — Test the status command (tmux integration)

In a second terminal, while a session is active:
```bash
cd <repo>
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"
node_modules/.bin/tsx src/index.ts status --format tmux
node_modules/.bin/tsx src/index.ts status --format plain
```

### Step 7 — Run automated tests

```bash
node_modules/.bin/vitest run
```

Expected output: `5 passed (5)` with `21 tests`.

---

## Common errors and solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `zsh: no such file or directory: node_modules/.bin/tsx` | Not in the project folder | Run Step 2 |
| `ReferenceError: __CHROMATO_VERSION__ is not defined` | Old code version (bug already fixed) | `git pull` |
| `ERR_DLOPEN_FAILED` on better-sqlite3 | Wrong Node.js version | Run Step 3 with `nvm use` |
| `command not found: nvm` | nvm not in current session PATH | Use the fallback `export PATH=...` in Step 3 |

---

## Available CLI options

```
chromato start
  -w, --work <minutes>       Work duration (default: 25)
  -b, --break <minutes>      Break duration (default: 5)
  -l, --long-break <minutes> Long break duration (default: 15)
  -c, --cycles <count>       Pomodoros per cycle (default: 4)
  --minimal                  Plain text output (no TUI)
  --no-color                 Suppress all ANSI color output

chromato status
  --format tmux              Compact string for tmux status bar
  --format plain             Human-readable output (default)
```

---

## Preview color palettes

To preview all available color palettes for the logo:
```bash
node scripts/preview-palettes.mjs
```

Current default: **C — Deep Ocean** (`#023e8a` → `#0077b6` → `#0096c7` → `#00b4d8` → `#90e0ef` → `#caf0f8`)
