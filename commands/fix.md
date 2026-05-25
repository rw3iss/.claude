# Lint, format, and fix errors

Clean up all lint, type, and format errors in the codebase. Do not commit — `/commit` handles that.

## Steps

1. **Detect the toolchain** — Inspect the project for known linter/formatter entry points: read `package.json` scripts, `Makefile`, `pyproject.toml`, `eslint.config.*`, `.prettierrc*`, `ruff.toml`, `.flake8`. Prefer project-defined commands (e.g. `make lint`, `pnpm lint`, `npm run lint`) over invoking tools directly.
2. **Run the linter** — Execute the project's lint command and capture the output. If no linter is configured, stop and tell the user.
3. **Auto-fix what you can** — Run the linter's fix mode if it has one (`ruff check --fix`, `eslint --fix`, `pnpm lint --fix`). Re-run the linter afterwards to see what remains.
4. **Fix remaining errors by hand** — For each residual error: read the file, understand the issue, apply a targeted fix.
5. **Run the formatter** — Execute the project's format command (`make fmt`, `pnpm format`, `black . && isort .`, `prettier --write .`). If no formatter is configured, skip this step — do not introduce a new one unasked.
6. **Verify clean** — Re-run the linter one final time. Report "all checks passed" if clean; otherwise list each remaining error and why you couldn't fix it.

## Rules

- Never disable a lint rule to silence an error without understanding why it fired. A targeted `# noqa` / `// eslint-disable-next-line` with a one-line reason comment is acceptable when the rule is genuinely wrong for that specific case; bulk-disabling rules or raising the whole file's warning level is not.
- Never introduce a new linter, formatter, or config file the project doesn't already have.
- Do not stage, commit, or push. This command only fixes errors.
