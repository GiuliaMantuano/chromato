/**
 * Distribution step definitions for chromato acceptance tests.
 *
 * Domain concept: release distribution, global install, SBOM, changelog
 *
 * Covers the npm-registry and github-releases environments.
 * All scenarios using these steps are tagged @skip (deferred to release gate).
 *
 * CM-A compliance: invokes chromato through the globally installed binary (CLI
 * driving port). No imports from src/ production code.
 *
 * Implementation notes:
 * - M7-01/M7-02 use a real "npm pack" + "npm install -g" flow in an isolated
 *   temp directory so the test replicates end-user installation exactly.
 * - M7-03/M7-04 shell out to the same toolchain used in the release workflow
 *   (cyclonedx-npm, git log) so the scenarios are executable specifications
 *   of the release pipeline, not mocks of it.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import type { ChromatoWorld } from './world';
import * as assert from 'assert';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Helpers local to this file
// ---------------------------------------------------------------------------

/**
 * Runs a shell command synchronously and returns stdout + exit code.
 * Does NOT throw on non-zero exit so the Then step can assert the outcome.
 */
function shell(
  command: string,
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): { stdout: string; stderr: string; exitCode: number } {
  const result = child_process.spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    cwd: opts.cwd ?? process.cwd(),
    env: opts.env ?? process.env,
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Given: distribution preconditions
// ---------------------------------------------------------------------------

Given(
  'chromato has been packed as a local npm tarball with {string}',
  function (this: ChromatoWorld, _packCommand: string) {
    // Locate the project root (four levels up from this file).
    const projectRoot = path.resolve(__dirname, '../../../../');

    // Run npm pack to produce the tarball in the project root.
    const result = shell('npm pack', { cwd: projectRoot });
    assert.strictEqual(
      result.exitCode,
      0,
      `"npm pack" failed (exit ${result.exitCode}):\n${result.stderr}`
    );

    // Find the produced tarball (npm pack outputs the filename on stdout).
    const tarballName = result.stdout.trim().split('\n').pop() ?? '';
    const tarballPath = path.join(projectRoot, tarballName);
    assert.ok(
      fs.existsSync(tarballPath),
      `Expected npm tarball at ${tarballPath} but it was not created`
    );

    // Store the tarball path on the world for subsequent steps.
    (this as ChromatoWorld & { tarballPath: string }).tarballPath = tarballPath;

    // Create a fresh temp directory that will serve as the install prefix.
    const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-global-'));
    (this as ChromatoWorld & { globalInstallDir: string }).globalInstallDir = installDir;
  }
);

Given(
  'chromato is installed globally from the local tarball',
  async function (this: ChromatoWorld) {
    const world = this as ChromatoWorld & {
      tarballPath?: string;
      globalInstallDir?: string;
      globalBinPath?: string;
    };

    // If the pack step did not run yet, run it now.
    if (!world.tarballPath) {
      const projectRoot = path.resolve(__dirname, '../../../../');
      const packResult = shell('npm pack', { cwd: projectRoot });
      assert.strictEqual(packResult.exitCode, 0, `"npm pack" failed:\n${packResult.stderr}`);
      const tarballName = packResult.stdout.trim().split('\n').pop() ?? '';
      world.tarballPath = path.join(projectRoot, tarballName);
      world.globalInstallDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-global-'));
    }

    // Install the tarball globally into the isolated prefix.
    const installResult = shell(
      `npm install -g --prefix "${world.globalInstallDir}" "${world.tarballPath}"`,
      { cwd: os.tmpdir() }
    );
    assert.strictEqual(
      installResult.exitCode,
      0,
      `Global install failed (exit ${installResult.exitCode}):\n${installResult.stderr}`
    );

    // Determine the path to the installed binary.
    const binDir = path.join(world.globalInstallDir, 'bin');
    world.globalBinPath = path.join(binDir, 'chromato');
  }
);

Given(
  'the project build has completed successfully',
  function (this: ChromatoWorld) {
    // The built dist/index.js was already resolved by the World constructor.
    // This step documents the precondition that the build artefact exists.
    const projectRoot = path.resolve(__dirname, '../../../../');
    const distEntry = path.join(projectRoot, 'dist', 'index.js');
    assert.ok(
      fs.existsSync(distEntry),
      `Build artefact not found at ${distEntry}. Run "pnpm build" first.`
    );
    (this as ChromatoWorld & { projectRoot: string }).projectRoot = projectRoot;
  }
);

Given(
  'conventional commits exist in the repository since the previous release tag',
  function (this: ChromatoWorld) {
    const projectRoot = path.resolve(__dirname, '../../../../');
    // Verify that at least one commit with a conventional prefix exists in the log.
    const result = shell(
      'git log --oneline --grep="^feat\\|^fix\\|^perf\\|^BREAKING" -1',
      { cwd: projectRoot }
    );
    // This step documents the precondition. If no matching commit exists the
    // Then step assertion will surface the gap rather than this Given step.
    (this as ChromatoWorld & { projectRoot: string }).projectRoot = projectRoot;
    this.capturedOutput = result.stdout;
  }
);

// ---------------------------------------------------------------------------
// When: distribution actions
// ---------------------------------------------------------------------------

When(
  'a developer installs the tarball globally with {string} in a fresh temporary directory',
  function (this: ChromatoWorld, _installCommand: string) {
    const world = this as ChromatoWorld & {
      tarballPath?: string;
      globalInstallDir?: string;
      globalBinPath?: string;
    };

    assert.ok(world.tarballPath, 'tarballPath not set -- run the Given step first');
    assert.ok(world.globalInstallDir, 'globalInstallDir not set -- run the Given step first');

    const installResult = shell(
      `npm install -g --prefix "${world.globalInstallDir}" "${world.tarballPath}"`,
      { cwd: os.tmpdir() }
    );
    this.exitCode = installResult.exitCode;
    this.capturedOutput = installResult.stdout;
    this.capturedStderr = installResult.stderr;

    // Derive the installed binary path.
    world.globalBinPath = path.join(world.globalInstallDir, 'bin', 'chromato');
  }
);

When(
  'the developer runs {string} from {string}',
  async function (this: ChromatoWorld, command: string, workingDir: string) {
    const world = this as ChromatoWorld & { globalBinPath?: string };
    const binPath = world.globalBinPath ?? 'chromato';

    // Derive the args from the command string, replacing "chromato" with the full path.
    const args = command.replace(/^chromato\s*/, '').trim();
    const fullCommand = `"${binPath}" ${args}`;

    const result = shell(fullCommand, { cwd: workingDir });
    this.exitCode = result.exitCode;
    this.capturedOutput = result.stdout;
    this.capturedStderr = result.stderr;
  }
);

When(
  '{string} generates the software bill of materials',
  function (this: ChromatoWorld, _toolName: string) {
    const world = this as ChromatoWorld & { projectRoot?: string; sbomOutput?: string };
    const projectRoot = world.projectRoot ?? path.resolve(__dirname, '../../../../');
    const sbomFile = path.join(projectRoot, 'sbom.cyclonedx.json');

    // Run the same SBOM generation command used in the release workflow.
    const result = shell(
      `pnpm dlx @cyclonedx/cyclonedx-npm` +
        ` --output-format JSON` +
        ` --output-file "${sbomFile}"` +
        ` --package-lock-only`,
      { cwd: projectRoot }
    );
    this.exitCode = result.exitCode;
    this.capturedStderr = result.stderr;

    if (result.exitCode === 0 && fs.existsSync(sbomFile)) {
      world.sbomOutput = fs.readFileSync(sbomFile, 'utf8');
      this.capturedOutput = world.sbomOutput;
    } else {
      this.capturedOutput = '';
    }
  }
);

When(
  'the release workflow generates the changelog for the new tag',
  function (this: ChromatoWorld) {
    const world = this as ChromatoWorld & { projectRoot?: string };
    const projectRoot = world.projectRoot ?? path.resolve(__dirname, '../../../../');

    // Use the same git log strategy as the release workflow in ci.yml.
    const prevTagResult = shell(
      'git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo ""',
      { cwd: projectRoot }
    );
    const prevTag = prevTagResult.stdout.trim();

    let changelogResult: { stdout: string; stderr: string; exitCode: number };
    if (prevTag) {
      changelogResult = shell(
        `git log ${prevTag}..HEAD --pretty=format:"- %s (%h)" --grep="^feat\\|^fix\\|^perf\\|^BREAKING"`,
        { cwd: projectRoot }
      );
    } else {
      // No previous tag -- list all conventional commits.
      changelogResult = shell(
        `git log --pretty=format:"- %s (%h)" --grep="^feat\\|^fix\\|^perf\\|^BREAKING"`,
        { cwd: projectRoot }
      );
    }

    this.exitCode = changelogResult.exitCode;
    this.capturedOutput = changelogResult.stdout;
    this.capturedStderr = changelogResult.stderr;
  }
);

// ---------------------------------------------------------------------------
// Then: distribution assertions
// ---------------------------------------------------------------------------

Then(
  '"chromato --version" runs successfully from outside the project directory',
  function (this: ChromatoWorld) {
    const world = this as ChromatoWorld & { globalBinPath?: string };
    const binPath = world.globalBinPath ?? 'chromato';

    const result = shell(`"${binPath}" --version`, { cwd: os.tmpdir() });
    this.exitCode = result.exitCode;
    this.capturedOutput = result.stdout;

    assert.strictEqual(
      result.exitCode,
      0,
      `"chromato --version" exited with code ${result.exitCode} from outside the project.\n` +
        `stderr: ${result.stderr}`
    );
  }
);

Then(
  'the command exits with code {int}',
  function (this: ChromatoWorld, expectedCode: number) {
    assert.strictEqual(
      this.exitCode,
      expectedCode,
      `Expected exit code ${expectedCode} but got ${this.exitCode}.\n` +
        `stdout: ${this.capturedOutput}\nstderr: ${this.capturedStderr}`
    );
  }
);

Then(
  'the output contains a semver string matching the pattern {string}',
  function (this: ChromatoWorld, _pattern: string) {
    // A semver string has the form MAJOR.MINOR.PATCH (optionally prefixed with 'v').
    const semverPattern = /v?\d+\.\d+\.\d+/;
    assert.match(
      this.capturedOutput,
      semverPattern,
      `Expected a semver string in the output but got:\n${this.capturedOutput}`
    );
  }
);

Then(
  'the SBOM output is well-formed and can be parsed as structured data',
  function (this: ChromatoWorld) {
    assert.ok(
      this.exitCode === 0,
      `SBOM generation failed (exit ${this.exitCode}):\n${this.capturedStderr}`
    );
    assert.ok(
      this.capturedOutput.trim().length > 0,
      'SBOM output is empty'
    );
    // Verify it is parseable as structured data.
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(this.capturedOutput) as Record<string, unknown>;
    } catch (err) {
      assert.fail(`SBOM output is not well-formed structured data:\n${(err as Error).message}`);
    }
    // Store for subsequent Then steps.
    (this as ChromatoWorld & { parsedSbom: Record<string, unknown> }).parsedSbom = parsed;
  }
);

Then(
  'the SBOM identifies the package name as {string}',
  function (this: ChromatoWorld, expectedName: string) {
    const world = this as ChromatoWorld & { parsedSbom?: Record<string, unknown> };
    assert.ok(world.parsedSbom, 'SBOM was not parsed -- run the "well-formed" Then step first');

    const sbomText = JSON.stringify(world.parsedSbom);
    assert.ok(
      sbomText.includes(expectedName),
      `Expected SBOM to identify package name "${expectedName}" but it was not found in:\n${sbomText.slice(0, 500)}`
    );
  }
);

Then(
  'the SBOM lists every dependency declared in the project manifest',
  function (this: ChromatoWorld) {
    const world = this as ChromatoWorld & { parsedSbom?: Record<string, unknown>; projectRoot?: string };
    assert.ok(world.parsedSbom, 'SBOM was not parsed -- run the "well-formed" Then step first');

    const projectRoot = world.projectRoot ?? path.resolve(__dirname, '../../../../');
    const manifestPath = path.join(projectRoot, 'package.json');
    assert.ok(
      fs.existsSync(manifestPath),
      `package.json not found at ${manifestPath}`
    );

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const declaredDeps = Object.keys(manifest.dependencies ?? {});

    const sbomText = JSON.stringify(world.parsedSbom);
    const missingDeps = declaredDeps.filter((dep) => !sbomText.includes(dep));

    assert.strictEqual(
      missingDeps.length,
      0,
      `The following dependencies declared in package.json are absent from the SBOM:\n` +
        missingDeps.join(', ')
    );
  }
);

Then(
  'the changelog contains at least one entry with a {string} or {string} commit prefix',
  function (this: ChromatoWorld, prefixA: string, prefixB: string) {
    const hasEntry =
      this.capturedOutput.includes(`${prefixA}:`) ||
      this.capturedOutput.includes(`${prefixB}:`);

    assert.ok(
      hasEntry,
      `Expected at least one changelog entry with prefix "${prefixA}:" or "${prefixB}:" ` +
        `but the generated changelog was:\n${this.capturedOutput || '(empty)'}`
    );
  }
);
