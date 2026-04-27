# Contributing to chromato

Thank you for your interest in contributing to chromato -- the Pomodoro timer your terminal deserves.
Whether you are fixing a bug, improving the docs, or adding a new feature, this guide will help you
get started. Check the issue tracker for tickets labeled **good first issue** if you are looking for
a place to begin.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Test Structure](#test-structure)
4. [Code Style](#code-style)
5. [Conventional Commits](#conventional-commits)
6. [Pull Request Process](#pull-request-process)
7. [Reporting Issues](#reporting-issues)

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js 20 LTS | `>=20.0.0` | Use nvm: `nvm install 20 && nvm use 20` |
| pnpm | `>=9.0.0` | `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate` |

---

## Development Setup

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/chromato.git
cd chromato

# 2. Install dependencies
pnpm install

# 3. Compile TypeScript
pnpm build

# 4. Run the full test suite
pnpm test

# 5. Generate a coverage report
pnpm coverage
```

### Useful dev commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm test` | Run all tests with Vitest |
| `pnpm coverage` | Run tests and produce a coverage report |
| `pnpm check:arch` | Enforce dependency-cruiser architecture rules |

### Bumping the package manager

`package.json` pins the package manager via the `packageManager` field (e.g. `"pnpm@10.33.2"`). If you change that version, regenerate `pnpm-lock.yaml` locally with `pnpm install` and commit both files together -- otherwise CI will fail with a lockfile/version mismatch.

---

## Test Structure

chromato uses a three-layer test structure mirroring the ports-and-adapters architecture:

| Directory | Scope | Notes |
|-----------|-------|-------|
| `tests/unit/` | Domain and application layers | No I/O; fast, isolated. Run with every save. |
| `tests/integration/` | Adapter layer | Uses real file system, temp dirs, and Ink test renderer. |
| `tests/acceptance/` | BDD feature specs | Full behaviour from CLI entry point inward. |

Run a specific layer:

```bash
pnpm test tests/unit/
pnpm test tests/integration/
pnpm test tests/acceptance/
```

---

## Code Style

chromato uses TypeScript strict mode (`"strict": true` in `tsconfig.json`). A few key rules:

- **No `any`**: Use proper types or `unknown` + narrowing.
- **TypeScript strict**: all strict checks must pass; no `@ts-ignore` without a comment explaining why.
- **Hexagonal boundaries**: `src/domain/` must never import from `src/adapters/` or framework packages.
  Adapters must not import each other. Enforced by `pnpm check:arch`.
- **OOP**: class-based design with dependency injection at the composition root (`src/index.ts`).
- **No global state**: all state flows through the `Session` aggregate root.
- **Formatting**: an automated formatter is not yet wired up. Match the surrounding style.

---

## Conventional Commits

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit types

| Type | When to use |
|------|-------------|
| `feat` | A new feature visible to users |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `test` | Adding or updating tests |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Build, tooling, or dependency updates |
| `perf` | A performance improvement |

### Examples

```
feat(timer): add OVERDUE phase with elapsed time display
fix(persistence): prevent race condition in state.json writer
docs: add CONTRIBUTING.md for open source contributors
test(session): cover phase transition boundary at 0 seconds remaining
```

---

## Pull Request Process

### Branch naming

Use the pattern `<type>/<short-description>`, e.g.:

```
feat/compact-mode-narrow-terminal
fix/status-format-tmux-timeout
docs/contributing-guide
```

### Before opening a PR

- [ ] `pnpm build` succeeds with no TypeScript errors
- [ ] `pnpm test` -- all tests green
- [ ] `pnpm coverage` -- no unexpected coverage regressions
- [ ] `pnpm check:arch` -- no architecture boundary violations
- [ ] Commit messages follow Conventional Commits
- [ ] New behaviour is covered by a test in `tests/unit/`, `tests/integration/`, or `tests/acceptance/`

### PR description checklist

Include in your PR description:

1. **What** -- a one-sentence summary of the change.
2. **Why** -- link the related issue (`Closes #<n>`).
3. **How** -- brief explanation of the approach taken.
4. **Test plan** -- describe how you verified the change.

### Review expectations

- All PRs require at least one maintainer approval before merge.
- Address review comments by pushing additional commits (do not force-push after review starts).
- Squash-merge is used; your PR title becomes the squash commit message -- make it a valid
  Conventional Commits subject line.

---

## Reporting Issues

Please use the GitHub issue templates:

- **Bug report**: describe expected vs actual behaviour, OS, Node.js version, and terminal emulator.
- **Feature request**: describe the use case and the value it provides to terminal-native developers.

For security vulnerabilities, do **not** open a public issue. Email the maintainers directly (see
`package.json` `author` field) or use GitHub private vulnerability reporting.
