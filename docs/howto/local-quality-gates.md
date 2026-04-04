# Local quality gates

chromato runs automated quality checks at two git hook stages. Gates catch issues on your machine before they reach CI, giving you a feedback loop measured in seconds rather than minutes.

---

## Gate map

| Stage | Hook | Gates | Typical duration |
|-------|------|-------|-----------------|
| Every commit | `pre-commit` | check:arch + build + unit/integration tests | ~35s |
| Every push | `pre-push` | check:arch + build + unit/integration + acceptance tests | ~3m |
| Manual / CI | `pnpm quality:gates` | Same as pre-push (all gates) | ~3m |

---

## Pre-commit hook

Runs on every `git commit`. The three fast gates always execute:

1. **Architecture boundaries** (`pnpm check:arch`) — dependency-cruiser verifies no layer violations (~2s)
2. **Build** (`pnpm build`) — esbuild compile; ensures `dist/` is always current (~3s)
3. **Unit + integration tests** (`pnpm test`) — vitest suite (~30s)

Acceptance tests are skipped by default because they take ~2m 34s.

### Run acceptance tests on a specific commit

```bash
RUN_ACCEPTANCE=1 git commit
```

---

## Pre-push hook

Runs on every `git push`. Executes all four gates including the full BDD acceptance suite (65 scenarios).

### Skip the pre-push hook for a WIP push

```bash
SKIP_TESTS=1 git push
```

Use sparingly. CI is the authoritative gate and will catch anything skipped locally.

---

## Full quality:gates script

Run the complete suite at any time without committing or pushing:

```bash
pnpm quality:gates
```

This is equivalent to what the pre-push hook runs and is also what CI executes.

---

## Emergency bypass

Both hooks respect `git`'s built-in `--no-verify` flag:

```bash
git commit --no-verify   # skips pre-commit
git push --no-verify     # skips pre-push
```

Only use these for genuine emergencies (e.g., fixing a broken main branch HEAD). CI will still run the full suite and block merges on failure.

---

## NO_COLOR support

Both hooks respect the `NO_COLOR` environment variable. When set, all ANSI colour sequences are suppressed — consistent with the chromato application itself (AC-P3).

```bash
NO_COLOR=1 git commit
```

---

## Hook locations

The hooks live in `.git/hooks/` and are not committed to the repository. If you clone the repo on a new machine, run the following once to restore them (or copy them from the `docs/howto/` directory if your team keeps a checked-in copy):

```bash
cp docs/howto/.git-hooks/pre-commit .git/hooks/pre-commit
cp docs/howto/.git-hooks/pre-push   .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

> Note: `.git/` is not tracked by git. Hooks are a per-clone setup step.
