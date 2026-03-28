/**
 * TuiAdapter: Ink 4.x React component renderer.
 * Implements RenderPort.
 *
 * Renders: phase label, progress bar (with percentage), countdown timer,
 * and session badge. Phase labels are always visible as text (accessibility NFR-05.1).
 *
 * CRITICAL: Do not import ink in domain or application files.
 */

import React from 'react';
import { render, Text, Box, useApp } from 'ink';
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

const PROGRESS_BAR_WIDTH = 20;
const BLOCK_FULL  = '█';
const BLOCK_EMPTY = '░';

function formatCountdown(remainingSeconds: number): string {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderProgressBar(fraction: number, useAscii: boolean): string {
  const filled = Math.round(fraction * PROGRESS_BAR_WIDTH);
  const empty = PROGRESS_BAR_WIDTH - filled;
  const full = useAscii ? '#' : BLOCK_FULL;
  const emptyChar = useAscii ? '-' : BLOCK_EMPTY;
  return full.repeat(filled) + emptyChar.repeat(empty);
}

interface FrameProps {
  snapshot: SessionSnapshot;
  onUnmount?: (() => void) | undefined;
}

const TimerFrame: React.FC<FrameProps> = ({ snapshot, onUnmount }) => {
  const { exit } = useApp();
  const { phase, timer, currentPomodoro, config } = snapshot;
  const colors = PHASE_COLORS[phase];
  const useColor = config.useColor;
  const useAscii = config.useAscii;

  const progressBar = renderProgressBar(timer.progressFraction, useAscii);
  const pct = Math.round(timer.progressFraction * 100);
  const countdown = formatCountdown(Math.ceil(timer.remainingSeconds));
  const badge = `POMODORO ${currentPomodoro} of ${config.cycleCount}`;

  React.useEffect(() => {
    if (onUnmount) {
      exit();
    }
  }, [exit, onUnmount]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text bold {...(useColor ? { color: colors.fg } : {})}>
          {phase}
        </Text>
        <Text>{'  '}</Text>
        <Text dimColor>{badge}</Text>
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
      this.inkInstance = render(element, { debug: this.testMode });

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
