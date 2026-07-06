/**
 * KPI-observability step (DISTILL — kpi-1/kpi-2 measurement contract).
 *
 * The session-history database IS the user-facing KPI surface: the owner
 * queries it locally with scripts/kpi-baseline.sql (zero telemetry, Option B
 * owner decision 2026-07-04). Asserting the recorded overdue episode is the
 * observable outcome at the driven-port boundary — the metric event must be
 * PRODUCIBLE, or kpi-1/kpi-2 have no data source.
 */

import { Then } from '@cucumber/cucumber';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import type { NotificationSessionWorld } from './session-helpers.js';

Then(
  'the session history records one overdue episode with its duration',
  function (this: NotificationSessionWorld) {
    const dbPath = path.join(this.tempDir, 'chromato', 'sessions.db');
    assert.ok(
      fs.existsSync(dbPath),
      `Session history database missing at ${dbPath} — the overdue episode was ` +
        `never recorded (KPI instrumentation not yet implemented).`,
    );
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      let episodes: { count: number; duration: number | null };
      try {
        episodes = db
          .prepare(
            'SELECT COUNT(*) AS count, MAX(duration_seconds) AS duration FROM overdue_episodes',
          )
          .get() as { count: number; duration: number | null };
      } catch (error) {
        assert.fail(
          `The overdue_episodes table does not exist — KPI instrumentation ` +
            `(kpi-1/kpi-2 data source) not yet implemented. (${(error as Error).message})`,
        );
      }
      assert.ok(
        episodes.count >= 1,
        `Expected at least one recorded overdue episode, found ${episodes.count}.`,
      );
      assert.ok(
        (episodes.duration ?? 0) >= 1,
        `Expected the episode to carry its duration in seconds, got ${episodes.duration}.`,
      );
    } finally {
      db.close();
    }
  },
);
