/**
 * TuiAdapter: Ink 4.x React component renderer.
 * Implements RenderPort.
 *
 * Renders: phase label, progress bar (with percentage), countdown timer,
 * and session badge. Phase labels are always visible as text (accessibility NFR-05.1).
 *
 * Compact mode: activates when columns < 40. Phase label is stacked above
 * the progress bar to prevent overflow on narrow terminals.
 *
 * CRITICAL: Do not import ink in domain or application files.
 */

import React from 'react';
import { render, Text, Box, useApp, useStdout, useInput, useStdin } from 'ink';
import type { RenderPort } from '../domain/ports.js';
import type { SessionSnapshot } from '../domain/types.js';
import type { PomodoroPhase } from '../domain/phase.js';
import { getPalette, type Palette } from '../domain/palette.js';

const COMPACT_THRESHOLD = 40;
const BLOCK_FULL  = '█';
const BLOCK_EMPTY = '░';

const ALTERNATE_SCREEN_ENTER = '\x1b[?1049h\x1b[2J\x1b[H';
const ALTERNATE_SCREEN_EXIT = '\x1b[?1049l';

function formatCountdown(remainingSeconds: number): string {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatOverdueCountdown(overdueElapsedSeconds: number): string {
  const minutes = Math.floor(overdueElapsedSeconds / 60);
  const seconds = Math.floor(overdueElapsedSeconds % 60);
  return `+${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Returns true when the overdue pulse should be dim (odd 2-second interval). */
function isOverdueDimPulse(overdueElapsedSeconds: number): boolean {
  return Math.floor(overdueElapsedSeconds / 2) % 2 === 1;
}

function barWidth(columns: number): number {
  return Math.max(8, columns - 20);
}

function renderProgressBar(fraction: number, useAscii: boolean, columns: number): string {
  const width = barWidth(columns);
  const filled = Math.round(fraction * width);
  const empty = width - filled;
  const full = useAscii ? '=' : BLOCK_FULL;
  const emptyChar = useAscii ? '-' : BLOCK_EMPTY;
  return full.repeat(filled) + emptyChar.repeat(empty);
}

export interface FrameProps {
  snapshot: SessionSnapshot;
  /** Resolved palette injected by the composition root. Defaults to ocean. */
  palette?: Palette | undefined;
  onUnmount?: (() => void) | undefined;
  /** Terminal column count. When omitted, reads from useStdout() hook. */
  columns?: number | undefined;
}

const PHASE_DISPLAY_LABELS: Record<PomodoroPhase, string> = {
  WORK:       'WORK',
  BREAK:      'BREAK',
  LONG_BREAK: 'LONG BREAK',
  OVERDUE:    'OVERDUE',
  IDLE:       'IDLE',
};

export const TimerFrame: React.FC<FrameProps> = ({ snapshot, palette, onUnmount, columns: columnsProp }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  // Forward Ctrl+C to SIGINT: in raw mode, Ctrl+C arrives as byte 0x03
  // (not a signal), so process.on('SIGINT') would never fire without this.
  //
  // Implementation uses direct stdin 'data' listener rather than useInput,
  // because useInput registers its handler via useEffect (async), which is
  // too late for synchronous test helpers that write to stdin immediately
  // after render. By subscribing to stdin.on('data') in the render body
  // (guarded by a ref to prevent double-registration), the handler is ready
  // before any synchronous stdin.write() calls.
  //
  // Guard with isRawModeSupported: helpers using real process.stdin (no TTY)
  // must not activate raw mode — the guard prevents errors in those tests.
  // ink-testing-library sets stdin.isTTY=true so isRawModeSupported=true there.
  const { stdin, isRawModeSupported } = useStdin();
  const sigintRegistered = React.useRef(false);
  if (isRawModeSupported && !sigintRegistered.current) {
    sigintRegistered.current = true;
    stdin.on('data', (data: string | Buffer) => {
      if (data.toString() === '\x03') {
        process.emit('SIGINT');
      }
    });
  }
  // Keep raw mode active so Ink consumes all keypresses (prevents bleed-through
  // to the shell). Guard ensures no-op when raw mode is unsupported.
  useInput((_input, _key) => { /* raw mode activation side effect */ }, {
    isActive: isRawModeSupported ?? false,
  });
  const stdoutColumns = (stdout as { columns?: number }).columns;
  const envColumns = process.env['COLUMNS'] ? parseInt(process.env['COLUMNS'], 10) : undefined;
  const resolvedColumns = columnsProp ?? envColumns ?? stdoutColumns ?? 80;

  const { phase, timer, currentPomodoro, completedToday, config } = snapshot;
  const activePalette = palette ?? getPalette('ocean');
  const colors = activePalette.phases[phase];
  const useColor = config.useColor;
  const useAscii = config.useAscii;

  const isCompact = resolvedColumns < COMPACT_THRESHOLD;

  const isOverdue = timer.isOverdue;
  const dimPulse = isOverdue && isOverdueDimPulse(timer.overdueElapsedSeconds);
  const progressBar = renderProgressBar(timer.progressFraction, useAscii, resolvedColumns);
  const pct = Math.round(timer.progressFraction * 100);
  const countdown = isOverdue
    ? formatOverdueCountdown(timer.overdueElapsedSeconds)
    : formatCountdown(Math.ceil(timer.remainingSeconds));
  const badge = `POMODORO ${currentPomodoro}/${config.cycleCount}`;
  const todayLabel = `Today: ${completedToday}`;
  const displayLabel = PHASE_DISPLAY_LABELS[phase];

  React.useEffect(() => {
    if (onUnmount) {
      exit();
    }
  }, [exit, onUnmount]);

  if (isCompact) {
    // Compact layout: stack elements vertically to fit in narrow terminal
    return (
      <Box flexDirection="column" padding={0}>
        <Box>
          <Text bold {...(useColor ? { color: colors.fg } : {})}>
            {displayLabel}
          </Text>
          <Text>{' '}</Text>
          <Text dimColor>{badge}</Text>
        </Box>
        <Box>
          <Text {...(useColor ? { color: colors.fg } : {})} {...(dimPulse ? { dimColor: true } : {})}>
            {progressBar}
          </Text>
          <Text>{` ${pct}%`}</Text>
          <Text>{' '}</Text>
          <Text bold>{countdown}</Text>
        </Box>
        <Box>
          <Text dimColor>{todayLabel}</Text>
        </Box>
        <Box>
          <Text dimColor>Press Ctrl+C to stop</Text>
        </Box>
      </Box>
    );
  }

  // Standard layout: phase label inline with badge and today count
  const fullBadge = `POMODORO ${currentPomodoro} of ${config.cycleCount}`;
  const fullTodayLabel = `Today: ${completedToday} sessions`;

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text bold {...(useColor ? { color: colors.fg } : {})}>
          {displayLabel}
        </Text>
        <Text>{'  '}</Text>
        <Text dimColor>{fullBadge}</Text>
        <Text>{'  '}</Text>
        <Text dimColor>{fullTodayLabel}</Text>
      </Box>
      <Box>
        <Text {...(useColor ? { color: colors.fg } : {})} {...(dimPulse ? { dimColor: true } : {})}>
          {progressBar}
        </Text>
        <Text>{` ${pct}%`}</Text>
        <Text>{'  '}</Text>
        <Text bold>{countdown}</Text>
      </Box>
      <Box>
        <Text dimColor>Press Ctrl+C to stop</Text>
      </Box>
    </Box>
  );
};

export class TuiAdapter implements RenderPort {
  private inkInstance: ReturnType<typeof render> | null = null;
  private testMode: boolean;
  private palette: Palette;

  constructor(palette: Palette = getPalette('ocean')) {
    this.palette = palette;
    this.testMode = process.env['NODE_ENV'] === 'test';
  }

  render(snapshot: SessionSnapshot): void {
    if (this.inkInstance === null) {
      // Enter alternate screen buffer so the TUI runs in an isolated screen.
      // On exit (stop()), the primary buffer is restored and the shell prompt
      // reappears cleanly — the same behaviour as vim, htop, lazygit, etc.
      // Enter alternate screen, clear it, and home the cursor so Ink
      // renders from the top-left (not the current shell cursor position).
      process.stdout.write(ALTERNATE_SCREEN_ENTER);
      const element = React.createElement(TimerFrame, {
        snapshot,
        palette: this.palette,
        onUnmount: this.testMode ? () => undefined : undefined,
      });
      this.inkInstance = render(element, { debug: this.testMode, exitOnCtrlC: false });

      if (this.testMode) {
        // In test mode, render first frame then exit immediately
        setImmediate(() => {
          this.stop();
        });
      }
    } else {
      this.inkInstance.rerender(
        React.createElement(TimerFrame, { snapshot, palette: this.palette })
      );
    }
  }

  stop(): void {
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }
    // Exit alternate screen buffer and restore the primary buffer + shell prompt.
    process.stdout.write(ALTERNATE_SCREEN_EXIT);
    // Do NOT call process.exit() here — caller is responsible for clean exit
  }
}
