/**
 * Regression test: `chromato status --width <invalid>` must not blank the output.
 *
 * Bug (security review 2026-06-22, finding F-4 / CWE-1284): a non-numeric, zero,
 * or negative `--width` value reached `parseInt` as NaN/<=0. Downstream,
 * `plain.length <= NaN` is always false and `plain.slice(0, NaN)` returns the
 * empty string, so `chromato status --format tmux` produced NO output -- silently
 * breaking the tmux status-line contract (AC-03.1).
 *
 * Fix: invalid widths fall back to the documented default (20) instead of NaN.
 *
 * Tests invoke through the CLI driving port (dist/index.js) via child_process and
 * seed an active session through a temp XDG_DATA_HOME, so the observable is the
 * port-boundary stdout string -- exactly what tmux consumes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..', '..');
const entryPoint = join(projectRoot, 'dist', 'index.js');

let dataHome: string;

function seedActiveSession(xdgDataHome: string): void {
  const stateDir = join(xdgDataHome, 'chromato');
  mkdirSync(stateDir, { recursive: true });
  const state = {
    schemaVersion: 1,
    phase: 'WORK',
    remainingSeconds: 900,
    elapsedSeconds: 600,
    progressFraction: 0.4,
    currentPomodoro: 1,
    cycleCount: 4,
    completedToday: 0,
    streak: 0,
    isOverdue: false,
    overdueElapsedSeconds: 0,
    lastUpdatedUtc: new Date().toISOString(),
  };
  writeFileSync(join(stateDir, 'state.json'), JSON.stringify(state));
}

function runStatus(...extraArgs: string[]): { stdout: string; status: number | null } {
  const result = spawnSync('node', [entryPoint, 'status', '--format', 'tmux', ...extraArgs], {
    encoding: 'utf8',
    env: { ...process.env, XDG_DATA_HOME: dataHome },
  });
  return { stdout: result.stdout.trim(), status: result.status };
}

// A valid tmux status string for an active session always carries an MM:SS time.
const STATUS_TIME = /\d{2}:\d{2}/;

describe('chromato status driving port -- --width validation (F-4 regression)', () => {
  beforeAll(() => {
    dataHome = mkdtempSync(join(tmpdir(), 'chromato-width-'));
    seedActiveSession(dataHome);
  });

  afterAll(() => {
    rmSync(dataHome, { recursive: true, force: true });
  });

  // Each invalid value must fall back to the default width and still render a
  // *valid* status string (not merely some non-empty output).
  it.each([
    ['abc'],
    ['0'],
    ['-5'],
  ])('renders a valid status string for invalid --width %s (was silently empty)', (value) => {
    expect(runStatus('--width', value).stdout).toMatch(STATUS_TIME);
  });

  it('honours a valid --width by bounding the output length', () => {
    expect(runStatus('--width', '15').stdout.length).toBeLessThanOrEqual(15);
  });

  it('exits with code 0 for invalid --width inputs', () => {
    for (const value of ['abc', '0', '-5']) {
      expect(runStatus('--width', value).status).toBe(0);
    }
  });
});
