/**
 * Returning-home launch guard (PURE module, ADR-012 DD-2 / DESIGN D-RH-1).
 *
 * RED scaffold (created by DISTILL, returning-home). Sibling of src/firstRun.ts.
 * No I/O, no ink/react/adapter imports. Takes isTTY/env/argv/configExists as
 * arguments so the composition root supplies the side-effecting reads.
 *
 * The `homeGuard-no-external` dependency-cruiser rule (D-RH-1) forbids this
 * module from importing ink, react, or anything under src/adapters/.
 *
 * DELIVER replaces the scaffold body with the real 5-condition predicate.
 */

export interface HomeGuardInput {
  /**
   * Whether the home screen has an interactive colour-capable stdout. This is a
   * SURROGATE the composition root supplies, NOT a literal `process.stdout.isTTY`:
   * index.ts passes `process.stdout.isTTY || chalk.level > 0` so that a real colour
   * TTY (isTTY true) AND a forced-colour pipe (FORCE_COLOR ⇒ chalk.level > 0, used
   * by the acceptance harness) both read as interactive, while a plain pipe
   * (chalk.level 0) falls through to help. The literal `stdout.isTTY` arm is
   * covered by these unit tests; the `chalk.level > 0` arm is exercised by the
   * FORCE_COLOR acceptance scenarios.
   */
  readonly isTTY: boolean;
  /** environment snapshot (reads NO_COLOR, CI). */
  readonly env: NodeJS.ProcessEnv;
  /** process.argv (checked for the --no-color flag). */
  readonly argv: readonly string[];
  /** whether config.json already exists. */
  readonly configExists: boolean;
}

/**
 * Normalises the environment the guard sees so a literal CI="false"/"0"/"" reads
 * as NOT-in-CI. The guard treats `CI` as "set ⇒ in CI", but the conventional
 * NOT-in-CI signal (and our test harness's CI="false", set to keep Ink off its
 * CI-buffered path) is a falsy string. Map those to `undefined` so the guard reads
 * them as not-in-CI, matching real CI tools; any other CI value (e.g. "true", "1")
 * is preserved unchanged. Pure: returns a shallow copy, no mutation of the input.
 */
export function normalizeGuardEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const normalized: NodeJS.ProcessEnv = { ...env };
  const ciValue = normalized['CI'];
  if (ciValue === 'false' || ciValue === '0' || ciValue === '') {
    delete normalized['CI'];
  }
  return normalized;
}

/**
 * Returns true iff the branded home screen should render:
 * configExists AND isTTY AND !NO_COLOR (env) AND no --no-color in argv AND !CI.
 * (AC-RH-01.1–01.6, SC-02, R3.)
 */
export function shouldShowHome(input: HomeGuardInput): boolean {
  return (
    input.configExists &&
    input.isTTY &&
    input.env['NO_COLOR'] === undefined &&
    input.env['CI'] === undefined &&
    !input.argv.includes('--no-color')
  );
}
