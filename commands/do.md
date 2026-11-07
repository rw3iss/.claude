# Do a single task or plan section

Perform one specific, scoped action — often a single section of a plan document — without expanding into neighboring work. This is the single-section counterpart to `/implement`, which runs a whole plan document.

## Arguments

- `$TASK` — a description of what to do. Usually a pointer into a document (e.g. "section 5.1 of docs/plans/in-progress/platform-audit.md") but may be a plain instruction with no document involved.

## Steps

1. **Understand the request** — Parse `$TASK`. If it points at a specific section of a document, locate and read that section plus enough surrounding context to understand it (its own status-table entry, anything it depends on) — don't read the rest of the document as work to do. If it's a plain instruction with no document, treat it as the whole task.
2. **Check for a plan-status folder convention** — If a document is involved and this repo tracks plan status by folder (an open-plans location → an `in-progress/` folder → a `completed/` folder; check the repo's CLAUDE.md/README for the exact layout), and the plan isn't already under `in-progress/`, move it there now, grepping the repo to update every reference to its old path in the same change. If the repo has no such convention, skip this — don't invent one.
3. **Do exactly the requested work** — Implement or fix only what was asked. Do not touch neighboring sections, do not "while I'm here" refactor adjacent code, do not expand scope.
4. **Update that one section of the document** — If the task derived from a plan document, edit ONLY the section that was worked: rewrite its text so it no longer proposes something already built, or append a dated status line (e.g. `> **STATUS 2026-08-29 — DONE.** Fixed; commit \`abc1234\`.`) using DONE / IN PROGRESS / BYPASSED / SUPERSEDED / BLOCKED (name the blocker) if the repo already has that vocabulary. If a finding turns out to be wrong, correct it in place and say so — don't silently delete it. Update that section's row in any summary/status table at the top; leave every other row untouched.
5. **Update surrounding documentation** — If the change affects public behavior, entry points, config, or setup steps, update the README and any other relevant docs in the same pass.
6. **Note completion, but don't close the plan** — If a document was involved, check whether every section now shows a resolved status. If so, tell the user the plan looks complete and that `/implement`'s closing steps (stamp the completion date, add closing notes, move to `completed/`) look ready to run — but do not perform them yourself.

## Rules

- Scope discipline is the whole point of this command: do the one thing asked, nothing adjacent.
- Never move the plan document to `completed/` — finishing one section is not finishing the plan; that move belongs to `/implement`.
- If a finding was wrong, correct it in place and label it — never silently delete it.
- If `$TASK` names no document, skip all plan-document bookkeeping and just do the task.
- Only use a plan's directory-based status convention when the repo already has it; never invent that structure in a repo that has none.
