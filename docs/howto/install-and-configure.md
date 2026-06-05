# How to Install and Configure chromato

## Prerequisites

**Goal**: Verify your system meets the minimum requirements before installing chromato.

1. Check your Node.js version:
   ```bash
   node --version
   ```

2. Confirm version is 20.0.0 or later.

   **✅ Success**: Output shows v20.x.x or higher (e.g., `v20.13.0`)

   **If your version is older**: Download Node.js 20 LTS from [nodejs.org](https://nodejs.org/) or use [nvm](https://github.com/nvm-sh/nvm) to install it.

3. Verify your npm version:
   ```bash
   npm --version
   ```

   **✅ Success**: npm is installed and displays a version number.

## Install chromato globally

**Goal**: Install chromato so you can run `chromato` from any terminal.

1. Install the package:
   ```bash
   npm install -g chromato
   ```

2. Verify the installation:
   ```bash
   chromato --version
   ```

   **✅ Success**: Output displays the version number (e.g., `1.0.0`)

   **Command not found?** Your npm global bin directory is not in your shell PATH. Add it to `~/.bashrc`, `~/.zshrc`, or equivalent:
   ```bash
   export PATH="$(npm config get prefix)/bin:$PATH"
   ```
   Then reload your shell: `source ~/.bashrc` or `source ~/.zshrc`.

## Configure with the setup wizard

**Goal**: Set your theme, timing, and notifications once, interactively.

1. The **first time** you run bare `chromato` (with no saved config), it launches the setup wizard automatically. You can also run it any time:
   ```bash
   chromato setup
   ```

2. The wizard walks you through: **Welcome → Theme** (with a live colour preview) **→ Timing** (the 25 · 5 × 4 default, or custom) **→ Notifications** (on/off; plus a tmux hint when run inside tmux) **→ Summary**. It then saves your choices and starts a session.

3. Your choices are written to `config.json` (default `~/.config/chromato/config.json`, or `$XDG_CONFIG_HOME/chromato/config.json`) and become the defaults for bare `chromato` and `chromato start`.

   **✅ Success**: After setup, running bare `chromato` shows a **home screen** — a recap of your theme, timing, and notifications, with a **Start / Reconfigure / Quit** menu. Choose **Reconfigure** (or run `chromato setup`) to change anything later.

   **Note**: The wizard and home screen require an interactive colour terminal. In a non-interactive context (piped, `NO_COLOR`, CI) bare `chromato` prints the standard help text instead.

## Run your first session

**Goal**: Start a Pomodoro session with default settings and verify it works.

1. Start a session:
   ```bash
   chromato start
   ```

2. You will see an animated progress bar with the current phase (WORK, BREAK, LONG_BREAK, or OVERDUE) and remaining time.

3. Stop the session by pressing Ctrl+C.

   **✅ Success**: The timer runs, responds to Ctrl+C, and exits cleanly with code 0.

## Customize work duration

**Goal**: Run a session with a different work duration (not the default 25 minutes).

1. Start a session with a custom work duration:
   ```bash
   chromato start --work 30
   ```

   Or use the short flag:
   ```bash
   chromato start -w 30
   ```

2. The session runs for 30 minutes instead of the default 25.

   **✅ Success**: The progress bar counts down from 30 minutes. Your custom duration appears in the status display.

## Customize break duration

**Goal**: Set custom break durations for short and long breaks.

1. Run a session with custom break duration:
   ```bash
   chromato start --break 10 --long-break 20
   ```

2. Each short break will be 10 minutes; the long break will be 20 minutes.

   **✅ Success**: After the work phase ends, the next phase (BREAK or LONG_BREAK) uses your specified durations.

## Set the cycle length

**Goal**: Change how many Pomodoros complete before a long break.

1. Run a session with 6 Pomodoros per cycle (instead of default 4):
   ```bash
   chromato start --count 6
   ```

2. The timer will complete 6 work phases before inserting a long break.

   **✅ Success**: After the 6th work phase, the next break is marked as LONG_BREAK in the display.

## Set all durations at once

**Goal**: Start a session with all custom durations in one command.

1. Run:
   ```bash
   chromato start -w 30 -b 10 -l 20 -c 6
   ```

2. This creates a session with:
   - 30-minute work phases
   - 10-minute short breaks
   - 20-minute long breaks
   - 6 Pomodoros per cycle

   **✅ Success**: All phases respect your specified durations throughout the session.

## Choose a colour palette

**Goal**: Change the TUI colour theme.

1. Pick one for a single run:
   ```bash
   chromato start --palette lavender
   ```
   Valid names: `ocean` (default), `lavender`, `berry`, `forest`.

2. To set it permanently, choose it in `chromato setup`, or set the environment variable:
   ```bash
   export CHROMATO_PALETTE=forest
   ```

   **✅ Success**: The progress bar and accents render in the chosen palette. Precedence is `--palette` > `CHROMATO_PALETTE` > `config.json` > default (`ocean`).

## Control a running session

**Goal**: Skip or quit from inside the running timer.

While a session is running in the TUI, the footer shows the keys for the current phase:

- During a **break** or **long break**: press `s` to skip straight to the next focus block.
- When **overdue** (a break ran long): press `s` to start work now.
- Any time: press `q` (or `Ctrl+C`) to quit cleanly.

During a WORK phase, skip is intentionally disabled — only `q` is offered.

**✅ Success**: `s` resets the countdown to a fresh WORK phase and advances the Pomodoro badge; `q` exits with code 0.

## Integrate with tmux

**Goal**: Display the chromato timer in your tmux status bar.

1. Open your tmux configuration file:
   ```bash
   nano ~/.tmux.conf
   ```

2. Add this line to display the timer on the right side of the status bar:
   ```
   set -g status-right "#(chromato status --format tmux)"
   set -g status-interval 5
   ```

3. Reload your tmux configuration:
   ```bash
   tmux source-file ~/.tmux.conf
   ```

   **✅ Success**: The chromato status appears on the right side of your tmux status bar and updates every 5 seconds while a session is active.

## Constrain tmux status width

**Goal**: Fit the chromato timer in a narrow tmux status bar.

1. In `~/.tmux.conf`, add the `--width` flag:
   ```
   set -g status-right "#(chromato status --format tmux --width 15)"
   set -g status-interval 5
   ```

2. Reload:
   ```bash
   tmux source-file ~/.tmux.conf
   ```

   **✅ Success**: The timer output is limited to 15 characters and fits in narrow terminals.

## Add chromato to your bash prompt

**Goal**: Display the chromato timer in your bash prompt.

1. Open your bash configuration:
   ```bash
   nano ~/.bashrc
   ```

2. Add this line to your PS1:
   ```bash
   PS1='$(chromato status --format prompt) \u@\h:\w\$ '
   ```

3. Save and reload your shell:
   ```bash
   source ~/.bashrc
   ```

   **✅ Success**: Your bash prompt now shows the chromato timer on the left before your username and host.

## Add chromato to your zsh prompt

**Goal**: Display the chromato timer in your zsh right prompt.

1. Open your zsh configuration:
   ```bash
   nano ~/.zshrc
   ```

2. Add this line:
   ```zsh
   RPROMPT='$(chromato status --format prompt)'
   ```

3. Save and reload your shell:
   ```bash
   source ~/.zshrc
   ```

   **✅ Success**: Your zsh right prompt shows the chromato timer.

## Add chromato to your fish prompt

**Goal**: Display the chromato timer in your fish right prompt.

1. Open or create your fish configuration:
   ```bash
   nano ~/.config/fish/config.fish
   ```

2. Add this function:
   ```fish
   function fish_right_prompt
       chromato status --format prompt
   end
   ```

3. Save and reload your shell:
   ```bash
   source ~/.config/fish/config.fish
   ```

   **✅ Success**: Your fish right prompt displays the chromato timer.

## Use minimal output mode

**Goal**: Run chromato with plain text output instead of the TUI for logging or piping to scripts.

1. Start a session with the `--minimal` flag:
   ```bash
   chromato start --minimal
   ```

2. The timer displays as plain text, one line per update. No ANSI colors or terminal UI.

3. Redirect output to a log file:
   ```bash
   chromato start --minimal > pomodoro.log 2>&1
   ```

   **✅ Success**: Output is plain text, suitable for logging, piping, or display in non-interactive environments.

## Suppress color output

**Goal**: Remove all ANSI color codes from chromato output.

Use either method:

**Method 1: Environment variable**
```bash
NO_COLOR=1 chromato start
```

**Method 2: Flag**
```bash
chromato start --no-color
```

Both disable color in all output modes: TUI, minimal, status, and help.

**✅ Success**: No ANSI escape sequences appear in output. Text is rendered without color.

## Use ASCII progress bar

**Goal**: Display the progress bar with ASCII characters instead of Unicode.

1. Run:
   ```bash
   chromato start --ascii
   ```

2. The progress bar uses `=` for filled and `-` for empty segments instead of Unicode blocks.

   **✅ Success**: Progress bar renders with `[===-------]` format instead of Unicode characters.

   **Note**: chromato automatically activates ASCII mode on terminals that don't support Unicode (e.g., older SSH sessions, specific terminal emulators).

## Read the state file

**Goal**: Access chromato's state file for use in custom scripts or integrations.

1. Locate the state file:
   ```bash
   cat ~/.local/share/chromato/state.json
   ```

   On macOS or if `XDG_DATA_HOME` is set, the path may differ. Check:
   ```bash
   echo "$XDG_DATA_HOME/chromato/state.json"
   ```

2. The file contains the current session state in JSON format:
   ```json
   {
     "schemaVersion": 1,
     "phase": "WORK",
     "remainingSeconds": 1200,
     "elapsedSeconds": 300,
     "progressFraction": 0.2,
     "currentPomodoro": 1,
     "cycleCount": 4,
     "completedToday": 0,
     "streak": 0,
     "isOverdue": false,
     "overdueElapsedSeconds": 0,
     "lastUpdatedUtc": "2026-04-04T10:00:00.000Z"
   }
   ```

3. Parse the JSON in a script:
   ```bash
   jq '.phase' ~/.local/share/chromato/state.json
   ```

   **✅ Success**: You can read and parse chromato's state for custom integrations or logging.

## Override state file location

**Goal**: Store the chromato state file in a custom directory.

1. Set the `XDG_DATA_HOME` environment variable before starting chromato:
   ```bash
   export XDG_DATA_HOME="/custom/path"
   chromato start
   ```

2. The state file will be created at `/custom/path/chromato/state.json`.

3. To make this permanent, add the export to your shell configuration:
   ```bash
   echo 'export XDG_DATA_HOME="/custom/path"' >> ~/.bashrc
   source ~/.bashrc
   ```

   **✅ Success**: chromato stores its state in your custom directory.

## Test with short durations

**Goal**: Run a short test session without waiting 25 minutes.

1. Use environment variables to override durations in seconds:
   ```bash
   CHROMATO_WORK_SECONDS=10 CHROMATO_BREAK_SECONDS=5 chromato start
   ```

2. The work phase runs for 10 seconds; breaks run for 5 seconds.

   **✅ Success**: A complete test cycle (work, short break, work) finishes in under a minute, useful for testing integrations or UI behavior.

## Run chromato without installing

**Goal**: Test or run chromato from a single command without installing globally.

1. Run directly with `npx`:
   ```bash
   npx chromato start
   ```

2. `npx` downloads and runs the latest version from npm without a global install.

   **✅ Success**: chromato starts and runs normally. The `npx` command exits cleanly when you press Ctrl+C.

## Troubleshoot: Command not found

**Problem**: `chromato: command not found`

**Solution**:

1. Verify installation:
   ```bash
   npm list -g chromato
   ```

2. If chromato is listed, your npm global bin directory is not in PATH. Add it to your shell config:
   ```bash
   export PATH="$(npm config prefix)/bin:$PATH"
   ```

3. Reload your shell and try again:
   ```bash
   source ~/.bashrc
   chromato --version
   ```

4. If chromato is not listed, reinstall:
   ```bash
   npm install -g chromato
   ```

## Troubleshoot: Progress bar shows ASCII on supported terminals

**Problem**: Progress bar uses ASCII characters even though your terminal supports Unicode.

**Solution**:

1. Verify your terminal supports UTF-8:
   ```bash
   echo $LANG
   ```

2. If LANG is not set to a UTF-8 locale (e.g., `en_US.UTF-8`), set it:
   ```bash
   export LANG=en_US.UTF-8
   ```

3. Reload your shell and restart chromato:
   ```bash
   chromato start
   ```

4. If the problem persists, explicitly disable ASCII mode (if applicable) or file an issue.

## Troubleshoot: State file missing

**Problem**: `~/.local/share/chromato/state.json` does not exist after running chromato.

**Solution**:

1. Verify the directory was created:
   ```bash
   ls -la ~/.local/share/chromato/
   ```

2. If the directory does not exist, create it:
   ```bash
   mkdir -p ~/.local/share/chromato
   ```

3. Run chromato again:
   ```bash
   chromato start
   ```

4. The state file will be created on the first run.

5. Verify:
   ```bash
   cat ~/.local/share/chromato/state.json
   ```

## Troubleshoot: Tmux status bar not updating

**Problem**: The chromato timer in your tmux status bar shows stale data.

**Solution**:

1. Check that `status-interval` is set to 5 seconds in `~/.tmux.conf`:
   ```
   set -g status-interval 5
   ```

2. If you changed the config, reload it:
   ```bash
   tmux source-file ~/.tmux.conf
   ```

3. Restart your tmux session:
   ```bash
   tmux kill-session -t <session-name>
   tmux new-session -s <session-name>
   ```

4. Verify chromato is running:
   ```bash
   chromato status --format tmux
   ```

---

> Built with [nWave](https://github.com/nwave-ai/nwave) — the AI-native software delivery framework.
