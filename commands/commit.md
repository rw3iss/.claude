# Lint, fix, and commit all changes

Fix errors, stage all current changes, write a commit message from the diff, commit to the current branch, and push.

## Steps

1. **Run `/fix`** — Execute the `/fix` command first to lint, auto-fix, and format. If errors remain after auto-fix, stop and surface them. Do not commit broken code.
2. **Stage changes** — Run `git status --short` to see what changed. Before `git add .`, scan the list for anything that looks like a secret (`.env`, `*.pem`, `credentials.*`, API keys, tokens) or a large binary. If anything suspicious is present, warn the user and stage files explicitly by name. If there are no changes at all, report that and stop — do not create an empty commit.
3. **Learn the project's commit style** — Run `git log --oneline -5` and match whatever convention the project uses (conventional commits, ticket-prefixed, plain prose, etc.).
4. **Draft the commit message** — Write a concise subject (under 70 characters) followed by a short bulleted body explaining what changed and why. Focus on intent, not a file list — the diff already shows what.
5. **Commit** — Use `git commit` with a HEREDOC-passed message so multi-line formatting is preserved:
   ```bash
   git commit -m "$(cat <<'EOF'
   subject line

   - bullet one
   - bullet two

   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```
6. **Push** — `git push origin <current-branch>`. Honor all pre-push hooks.
7. **Report** — Summarize the commit subject, short SHA, branch, and whether the push succeeded.

## Rules

- Never force-push (`--force`, `--force-with-lease`) unless the user explicitly asks.
- Never skip hooks (`--no-verify`) unless the user explicitly asks. If a hook fails, fix the underlying issue and create a new commit; do not amend published work.
- Never commit files that look like secrets. Warn and ask first.
- Commit to the current branch. If the user wants to merge and push to a development branch instead, they should use `/push-to-dev`.
