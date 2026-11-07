# Execute an implementation plan

Implement all features described in a plan file, section by section, until every item is complete and all tests pass.

## Arguments

- `$PLAN_FILE` — path to the plan markdown file. If not supplied, look for `PLAN.md`, `plan.md`, or `IMPLEMENTATION_PLAN.md` in the project root.

## Steps

1. **Locate the plan** — Resolve `$PLAN_FILE` from the user's argument or by searching the project root. If no plan can be found, stop and ask the user where it is.
2. **Check for a plan-status folder convention** — Some repos track a plan's status by which folder it lives in (an open-plans location → an `in-progress/` folder → a `completed/` folder; check that repo's CLAUDE.md/README for the exact layout). If this repo uses that convention and the plan isn't already under its `in-progress/` folder, move it there now, and grep the repo for the old path to update every reference (docs, other plans, code comments) in the same change. If the repo has no such convention, skip this step — don't invent folder structure it doesn't have.
3. **Read the whole plan** — Read the full file before touching any code. Note section boundaries, dependencies between sections, and any sections that would be more efficient to implement together (e.g. two sections that touch the same module).
4. **Survey the codebase** — Skim `CLAUDE.md`, `README.md`, and the main entry points to understand existing architecture, naming conventions, and project-specific quirks. New code should fit the existing style, not invent a new one.
5. **Implement section by section** — Work through the plan in order, or in a smarter grouped order when two sections are tightly coupled. For each section:
   - Implement every item listed under it.
   - Extract shared logic into utilities or separate files only when it is actually reused — do not pre-abstract.
   - Follow SOLID principles and the project's existing conventions.
   - Re-read the section items when you think it's done, to verify nothing was skipped.
6. **Update the plan document itself, per section** — This is part of the work, not a follow-up. As each section finishes, edit the plan file: rewrite its text so it no longer proposes something already built, or append a dated status line (e.g. `> **STATUS 2026-08-29 — DONE.** Implemented; commit \`abc1234\`.`) using DONE / IN PROGRESS / BYPASSED / SUPERSEDED / BLOCKED (name the blocker) if the repo already has that vocabulary, or a plain equivalent otherwise. If something the plan claimed turns out to be wrong, correct it in place and say so — don't silently delete it. Keep any summary/status table at the top of the plan in step.
7. **Update surrounding documentation** — When a section changes public behavior, entry points, config, scripts, or setup steps, update the README and any other relevant docs in the same pass. This is separate from step 6 — the plan document tracks progress, the README/docs describe the shipped product.
8. **Run the tests** — Execute the project's test command. Fix any failures until all tests pass. If the plan specifies tests to write, write them alongside the implementation (TDD-style where possible).
9. **Final verification pass** — Re-read the entire plan file one more time. For every section, confirm its items are implemented, working, and marked accordingly in the plan document. Report any gaps.
10. **Close out the plan** — Once every section is done: stamp the completion date, and add closing notes at the bottom (final status, anything deliberately not done and why, what to watch). Then, only if this repo already has a `completed/` plans folder, move the finished plan there and update every reference to its old path (grep first). If no such folder convention exists here, say so and leave the file where it is — don't create one.

## Rules

- Do not stop partway. Implement all sections the plan specifies before reporting done.
- Do not add features the plan doesn't ask for. Scope discipline matters — surprises in the diff are a failure mode, not a feature.
- Do not rewrite unrelated working code to impose a personal style. Refactor only when the plan calls for it or when the new code genuinely requires restructuring to fit cleanly.
- If a section is ambiguous, conflicts with the existing codebase, or requires decisions the plan doesn't cover, stop and ask the user before guessing.
- For features that would benefit from dev/test tooling, add scripts to `package.json`, `Makefile`, or a `scripts/` directory — don't leave them as ad-hoc commands only in your head.
- Only use a plan's directory-based status convention (in-progress/completed folders) when the repo already has it; never invent that structure in a repo that has none.
