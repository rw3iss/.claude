# commit, merge, and push changes to the development branch

Take all the current changes, commit them on a working branch, merge that branch into the project's development branch, and push.

## Step 1 — Preflight

1. Run `git status --short`. If there are **zero** changes **and** the current branch is already up to date with its upstream, tell the user there's nothing to push and stop.
2. Run `git rev-parse --abbrev-ref HEAD` to get the current branch name.
3. Detect the project's development branch by checking, in this order, for the first one that exists on the remote:
   - `development`
   - `develop`
   - `dev`
   Use: `git ls-remote --heads origin development develop dev`.
   If none exist, fall back to asking the user what branch to target (use `AskUserQuestion`), and remember it for the rest of this run.
4. Decide whether to create a temporary working branch:
   - If the current branch is `main`, `master`, the detected dev branch itself, or any protected/trunk branch → **yes**, create a temp branch.
   - Otherwise (user is already on a feature branch) → **no**, commit on the current branch.
   When creating a temp branch, name it `work/<short-description>-<YYYYMMDD-HHMM>` where `<short-description>` is 2–4 kebab-case words summarizing the change. Use `git switch -c <name>` to create and switch.

## Step 2 — Lint, format, and commit

5. Run the `/fix` command (or the project's equivalent — e.g. `make fmt && make lint`, `npm run lint`, `ruff check --fix && black . && isort .`, whichever is set up). If lint errors remain after auto-fix, surface them to the user and stop — **do not** commit broken code.
6. `git add .` all changes (warn the user first if any of them look like secrets, env files, credentials, or large binaries — in that case, add files explicitly by name instead of `.`).
7. Draft a conventional-commit-style message by analyzing the diff. Lead with a one-line subject (`fix: ...`, `feat: ...`, `refactor: ...`, `chore: ...`). Follow with a brief bullet-point body describing what changed and why. Match the project's commit history style — run `git log --oneline -5` first and adapt the subject prefix to what the project actually uses.
8. Commit with `git commit -m "$(cat <<'EOF' ... EOF)"` HEREDOC form so multi-line messages format correctly.

## Step 3 — Merge into the development branch

9. `git fetch origin` to get the latest state of the dev branch.
10. `git switch <dev-branch>` and `git pull --ff-only origin <dev-branch>` to bring it current. If the pull fails because dev has diverged, stop and report — the user needs to resolve that themselves.
11. `git merge --no-ff <working-branch> -m "Merge <working-branch> into <dev-branch>"`. Use `--no-ff` so the merge is always a distinct commit — this preserves the grouping of the feature work and makes reverts cleaner. If the merge has conflicts, stop and report the conflicted files; do not attempt auto-resolution.
12. Run a quick sanity check appropriate to the project:
    - Python: `make lint` or `ruff check`
    - Node: `npm run lint` or `npm run typecheck`
    - Other: just confirm `git status` is clean
    If the check fails on the merged dev branch, abort the merge with `git reset --hard ORIG_HEAD`, restore the working branch, and report the failure.

## Step 4 — Push

13. `git push origin <dev-branch>`. If a pre-push hook runs lint/tests and fails, surface the failure and stop — do **not** use `--no-verify` unless the user explicitly asks for it.
14. After a successful push, confirm with `git log --oneline -3` on the dev branch so the user sees the commits that landed.

## Step 5 — Cleanup

15. If you created a temp branch in step 4, delete it locally with `git branch -D <working-branch>` (it's merged into dev, so it's safe to drop). Do **not** push a branch delete to origin unless asked.
16. If the user was originally on a feature branch, leave them on the dev branch after the push (they can `git switch -` to return) — but mention this in your final summary so they know where they are.

## Safety rules (never violate these)

- **Never force-push** (`git push --force` / `--force-with-lease`) unless the user explicitly asks.
- **Never skip pre-commit or pre-push hooks** (`--no-verify`) unless the user explicitly asks.
- **Never commit files that look like secrets** (`.env`, `*.pem`, `credentials.*`, tokens). If any such files are staged, stop and warn the user before committing.
- **Never push directly to main/master** — this command targets the development branch only. If the user is asking to push straight to main, tell them to use `/commit` (which pushes to the current branch) or do it manually.
- **If a step fails, stop** — do not try creative workarounds. Report what failed and let the user decide.

## Reporting

When finished, give the user a concise summary:
- The working branch you committed on (and whether it was a temp branch you created)
- The commit subject and SHA
- The merge commit SHA on dev
- The pushed ref (`origin/<dev-branch>`)
- Whether the temp branch was cleaned up
- Which branch they are currently checked out on

## Project-specific overrides

Projects can override this command by creating `.claude/commands/push-to-dev.md` in the project root — the project-level file takes precedence over this user-level default. Override it when:
- The dev branch has a non-standard name (e.g. `staging`, `next`, `integration`)
- The project requires a different merge strategy (e.g. squash merges, or PRs instead of direct pushes)
- The project has custom pre-push validation that shouldn't be skipped
