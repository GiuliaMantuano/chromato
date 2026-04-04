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
import { render, Text, Box, useApp, useStdout } from 'ink';
import type { RenderPort } from '../domain/ports.js';
import type { SessionSnapshot } from '../domain/types.js';
import type { PomodoroPhase } from '../domain/phase.js';

interface PhaseColor {
  fg: string;
  bg: string;
}

const PHASE_COLORS: Record<PomodoroPhase, PhaseColor> = {
  WORK:       { fg: '#00d7ff', bg: '#00ff00' },
  BREAK:      { fg: '#005fff', bg: '#5f00ff' },
  LONG_BREAK: { fg: '#af00ff', bg: '#00afff' },
  OVERDUE:    { fg: '#ff0000', bg: '#ffaf00' },
  IDLE:       { fg: '#808080', bg: '#808080' },
};

const COMPACT_THRESHOLD = 40;
const BLOCK_FULL  = '█';
const BLOCK_EMPTY = '░';

function formatCountdown(remainingSeconds: number): string {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

export const TimerFrame: React.FC<FrameProps> = ({ snapshot, onUnmount, columns: columnsProp }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const stdoutColumns = (stdout as { columns?: number }).columns;
  const envColumns = process.env['COLUMNS'] ? parseInt(process.env['COLUMNS'], 10) : undefined;
  const resolvedColumns = columnsProp ?? envColumns ?? stdoutColumns ?? 80;

  const { phase, timer, currentPomodoro, completedToday, config } = snapshot;
  const colors = PHASE_COLORS[phase];
  const useColor = config.useColor;
  const useAscii = config.useAscii;

  const isCompact = resolvedColumns < COMPACT_THRESHOLD;

  const progressBar = renderProgressBar(timer.progressFraction, useAscii, resolvedColumns);
  const pct = Math.round(timer.progressFraction * 100);
  const countdown = formatCountdown(Math.ceil(timer.remainingSeconds));
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
          <Text {...(useColor ? { color: colors.fg } : {})}>
            {progressBar}
          </Text>
          <Text>{` ${pct}%`}</Text>
          <Text>{' '}</Text>
          <Text bold>{countdown}</Text>
        </Box>
        <Box>
          <Text dimColor>{todayLabel}</Text>
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
        <Text {...(useColor ? { color: colors.fg } : {})}>
          {progressBar}
        </Text>
        <Text>{` ${pct}%`}</Text>
        <Text>{'  '}</Text>
        <Text bold>{countdown}</Text>
      </Box>
    </Box>
  );
};

export class TuiAdapter implements RenderPort {
  private inkInstance: ReturnType<typeof render> | null = null;
  private testMode: boolean;

  constructor() {
    this.testMode = process.env['NODE_ENV'] === 'test';
  }

  render(snapshot: SessionSnapshot): void {
    if (this.inkInstance === null) {
      const element = React.createElement(TimerFrame, {
        snapshot,
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
        React.createElement(TimerFrame, { snapshot })
      );
    }
  }

  stop(): void {
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }
    // Do NOT call process.exit() here — caller is responsible for clean exit
  }
}
