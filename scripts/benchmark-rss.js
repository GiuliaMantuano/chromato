#!/usr/bin/env node
/**
 * benchmark-rss.js
 *
 * Measures RSS memory and CPU usage of chromato in steady-state idle.
 *
 * Methodology (ci-cd-pipeline.md Section 5):
 *   1. Spawn `node dist/index.js start` as a child process (25-minute work session).
 *   2. Wait 30 seconds for steady state (tick loop fully running).
 *   3. Read RSS via /proc/{pid}/status (Linux) or `ps -o rss= -p {pid}` (macOS).
 *   4. Measure CPU average over 30 seconds via pidstat (Linux) or ps repeated samples (macOS).
 *   5. Send SIGTERM; verify child exits cleanly.
 *   6. Fail with exit code 1 if RSS > 35 MB OR CPU > 1%.
 *   7. Write results to benchmark-results.json.
 *
 * Gates:
 *   RSS steady-state  < 35 MB
 *   CPU idle average  < 1 %
 */

'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const RSS_LIMIT_MB = 35;
const CPU_LIMIT_PCT = 1.0;
const STEADY_STATE_WAIT_MS = 30_000;
const CPU_SAMPLE_DURATION_S = 30;
const CPU_SAMPLE_INTERVAL_MS = 1_000;

const DIST_ENTRY = path.resolve(__dirname, '..', 'dist', 'index.js');
const RESULTS_FILE = path.resolve(__dirname, '..', 'benchmark-results.json');

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

/**
 * Reads RSS for a given PID in kilobytes.
 * Returns a number (kB) or throws on failure.
 */
function readRssKb(pid) {
  const platform = os.platform();

  if (platform === 'linux') {
    // /proc/{pid}/status contains: VmRSS: <n> kB
    const statusPath = `/proc/${pid}/status`;
    const content = fs.readFileSync(statusPath, 'utf8');
    const match = content.match(/^VmRSS:\s+(\d+)\s+kB/m);
    if (!match) {
      throw new Error(`VmRSS not found in ${statusPath}`);
    }
    return parseInt(match[1], 10);
  }

  if (platform === 'darwin') {
    // ps -o rss= returns RSS in kB on macOS
    const output = execSync(`ps -o rss= -p ${pid}`, { encoding: 'utf8' }).trim();
    const value = parseInt(output, 10);
    if (isNaN(value)) {
      throw new Error(`Unexpected ps output for pid ${pid}: "${output}"`);
    }
    return value;
  }

  throw new Error(`Unsupported platform for RSS measurement: ${platform}`);
}

/**
 * Measures average CPU % for `pid` over `durationS` seconds.
 * Linux: uses pidstat (sysstat package, must be installed in CI via apt).
 * macOS: takes repeated `ps -o %cpu=` samples every second and averages them.
 * Returns a number (percentage, 0-100 scale).
 */
async function measureCpuPct(pid, durationS) {
  const platform = os.platform();

  if (platform === 'linux') {
    // pidstat -u -p {pid} 1 {durationS}
    // Output lines contain "%usr" etc.; the "Average:" summary line is used.
    return new Promise((resolve, reject) => {
      let output = '';
      const ps = spawn('pidstat', ['-u', '-p', String(pid), '1', String(durationS)]);
      ps.stdout.on('data', (chunk) => { output += chunk.toString(); });
      ps.stderr.on('data', (chunk) => { /* ignore */ });
      ps.on('error', reject);
      ps.on('close', () => {
        // Parse the "Average:" summary line produced by pidstat.
        // Typical format (columns vary by sysstat version):
        //   Average:   1000      0.07      0.00      0.00      0.00     99.93   node
        // The %usr column is column index 3 (0-based after the "Average:" token).
        const lines = output.split('\n');
        const avgLine = lines.find((l) => l.startsWith('Average:'));
        if (!avgLine) {
          // Fallback: if pidstat is not producing an Average line, sum usr+sys columns
          // from all data lines for this pid and average.
          const dataLines = lines.filter((l) => l.includes(String(pid)) && !l.startsWith('#'));
          if (dataLines.length === 0) {
            return resolve(0);
          }
          const cpuValues = dataLines.map((l) => {
            const cols = l.trim().split(/\s+/);
            // usr is col 3, sys is col 4 (0-based from line start)
            return (parseFloat(cols[3]) || 0) + (parseFloat(cols[4]) || 0);
          });
          const avg = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;
          return resolve(avg);
        }
        const cols = avgLine.trim().split(/\s+/);
        // Average: UID PID %usr %system %guest %wait %CPU CPU Command
        // %CPU is col 7 (0-based), usr is col 3.
        // Use %CPU (sum of all CPU) if available (column 7), else usr+sys.
        const cpuCol7 = parseFloat(cols[7]);
        if (!isNaN(cpuCol7)) {
          return resolve(cpuCol7);
        }
        const usr = parseFloat(cols[3]) || 0;
        const sys = parseFloat(cols[4]) || 0;
        return resolve(usr + sys);
      });
    });
  }

  if (platform === 'darwin') {
    // macOS: sample ps -o %cpu= every second for durationS seconds.
    return new Promise((resolve) => {
      const samples = [];
      let elapsed = 0;

      const interval = setInterval(() => {
        try {
          const raw = execSync(`ps -o %cpu= -p ${pid} 2>/dev/null`, { encoding: 'utf8' }).trim();
          const value = parseFloat(raw);
          if (!isNaN(value)) {
            samples.push(value);
          }
        } catch (_) {
          // Process may have exited; ignore.
        }
        elapsed += 1;
        if (elapsed >= durationS) {
          clearInterval(interval);
          const avg = samples.length > 0
            ? samples.reduce((a, b) => a + b, 0) / samples.length
            : 0;
          resolve(avg);
        }
      }, CPU_SAMPLE_INTERVAL_MS);
    });
  }

  throw new Error(`Unsupported platform for CPU measurement: ${platform}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[benchmark-rss] Starting chromato process...');

  if (!fs.existsSync(DIST_ENTRY)) {
    console.error(`[benchmark-rss] ERROR: dist/index.js not found at ${DIST_ENTRY}`);
    console.error('[benchmark-rss] Run `pnpm build` before executing this benchmark.');
    process.exit(1);
  }

  // Spawn chromato with a 25-minute work session. The child runs independently.
  const child = spawn(process.execPath, [DIST_ENTRY, 'start', '--work', '25'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  child.stdout.on('data', () => { /* drain to prevent back-pressure */ });
  child.stderr.on('data', () => { /* drain */ });

  const childPid = child.pid;
  console.log(`[benchmark-rss] Child PID: ${childPid}`);

  // Allow the process to exit early (e.g. if dist/index.js fails to start).
  let childExitedEarly = false;
  let childExitCode = null;
  child.on('exit', (code) => {
    childExitedEarly = true;
    childExitCode = code;
  });

  // Wait for steady state (30 seconds).
  console.log(`[benchmark-rss] Waiting ${STEADY_STATE_WAIT_MS / 1000}s for steady state...`);
  await new Promise((resolve) => setTimeout(resolve, STEADY_STATE_WAIT_MS));

  if (childExitedEarly) {
    console.error(`[benchmark-rss] ERROR: Child process exited early with code ${childExitCode}`);
    process.exit(1);
  }

  // --- Measure RSS ---
  let rssKb;
  try {
    rssKb = readRssKb(childPid);
  } catch (err) {
    console.error(`[benchmark-rss] ERROR reading RSS: ${err.message}`);
    child.kill('SIGTERM');
    process.exit(1);
  }
  const rssMb = rssKb / 1024;
  console.log(`[benchmark-rss] RSS: ${rssMb.toFixed(2)} MB (limit: ${RSS_LIMIT_MB} MB)`);

  // --- Measure CPU over 30 seconds ---
  console.log(`[benchmark-rss] Measuring CPU over ${CPU_SAMPLE_DURATION_S}s...`);
  let cpuPct;
  try {
    cpuPct = await measureCpuPct(childPid, CPU_SAMPLE_DURATION_S);
  } catch (err) {
    console.error(`[benchmark-rss] ERROR measuring CPU: ${err.message}`);
    child.kill('SIGTERM');
    process.exit(1);
  }
  console.log(`[benchmark-rss] CPU average: ${cpuPct.toFixed(3)}% (limit: ${CPU_LIMIT_PCT}%)`);

  // --- Terminate child ---
  console.log('[benchmark-rss] Sending SIGTERM to child process...');
  child.kill('SIGTERM');

  // Wait up to 5 seconds for clean exit.
  const exitCode = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(null);
    }, 5_000);
    child.on('exit', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  if (exitCode !== 0 && exitCode !== null) {
    console.warn(`[benchmark-rss] WARNING: Child exited with code ${exitCode} (expected 0 or null on SIGTERM)`);
  }

  // --- Evaluate gates ---
  const rssFailed = rssMb > RSS_LIMIT_MB;
  const cpuFailed = cpuPct > CPU_LIMIT_PCT;

  // --- Write results ---
  const results = {
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    rss: {
      valueKb: rssKb,
      valueMb: parseFloat(rssMb.toFixed(3)),
      limitMb: RSS_LIMIT_MB,
      passed: !rssFailed,
    },
    cpu: {
      averagePct: parseFloat(cpuPct.toFixed(3)),
      limitPct: CPU_LIMIT_PCT,
      sampleDurationS: CPU_SAMPLE_DURATION_S,
      passed: !cpuFailed,
    },
    overall: {
      passed: !rssFailed && !cpuFailed,
    },
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log(`[benchmark-rss] Results written to ${RESULTS_FILE}`);
  console.log(JSON.stringify(results, null, 2));

  // --- Write to GitHub Actions step summary if available ---
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    const summary = [
      '## RSS and CPU Benchmark Results',
      '',
      `| Metric | Value | Limit | Status |`,
      `|--------|-------|-------|--------|`,
      `| RSS steady-state | ${rssMb.toFixed(2)} MB | ${RSS_LIMIT_MB} MB | ${rssFailed ? 'FAIL' : 'PASS'} |`,
      `| CPU idle average | ${cpuPct.toFixed(3)}% | ${CPU_LIMIT_PCT}% | ${cpuFailed ? 'FAIL' : 'PASS'} |`,
      '',
    ].join('\n');
    fs.appendFileSync(summaryFile, summary, 'utf8');
  }

  // --- Fail the job if any gate breached ---
  if (rssFailed) {
    console.error(`[benchmark-rss] GATE FAILED: RSS ${rssMb.toFixed(2)} MB exceeds ${RSS_LIMIT_MB} MB limit`);
  }
  if (cpuFailed) {
    console.error(`[benchmark-rss] GATE FAILED: CPU ${cpuPct.toFixed(3)}% exceeds ${CPU_LIMIT_PCT}% limit`);
  }
  if (rssFailed || cpuFailed) {
    process.exit(1);
  }

  console.log('[benchmark-rss] All gates passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(`[benchmark-rss] Unhandled error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
