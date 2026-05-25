# Execute an implementation plan

Implement all features described in a plan file, section by section, until every item is complete and all tests pass.

## Arguments

- `$PLAN_FILE` — path to the plan markdown file. If not supplied, look for `PLAN.md`, `plan.md`, or `IMPLEMENTATION_PLAN.md` in the project root.

## Steps

1. **Locate the plan** — Resolve `$PLAN_FILE` from the user's argument or by searching the project root. If no plan can be found, stop and ask the user where it is.
2. **Read the whole plan** — Read the full file before touching any code. Note section boundaries, dependencies between sections, and any sections that would be more efficient to implement together (e.g. two sections that touch the same module).
3. **Survey the codebase** — Skim `CLAUDE.md`, `README.md`, and the main entry points to understand existing architecture, naming conventions, and project-specific quirks. New code should fit the existing style, not invent a new one.
4. **Implement section by section** — Work through the plan in order, or in a smarter grouped order when two sections are tightly coupled. For each section:
   - Implement every item listed under it.
   - Extract shared logic into utilities or separate files only when it is actually reused — do not pre-abstract.
   - Follow SOLID principles and the project's existing conventions.
   - Re-read the section items when you think it's done, to verify nothing was skipped.
5. **Update documentation** — When a section changes public behavior, entry points, config, scripts, or setup steps, update the README and any relevant docs in the same pass.
6. **Run the tests** — Execute the project's test command. Fix any failures until all tests pass. If the plan specifies tests to write, write them alongside the implementation (TDD-style where possible).
7. **Final verification pass** — Re-read the entire plan file one more time. For every section, confirm its items are implemented and working. Report any gaps.

## Rules

- Do not stop partway. Implement all sections the plan specifies before reporting done.
- Do not add features the plan doesn't ask for. Scope discipline matters — surprises in the diff are a failure mode, not a feature.
- Do not rewrite unrelated working code to impose a personal style. Refactor only when the plan calls for it or when the new code genuinely requires restructuring to fit cleanly.
- If a section is ambiguous, conflicts with the existing codebase, or requires decisions the plan doesn't cover, stop and ask the user before guessing.
- For features that would benefit from dev/test tooling, add scripts to `package.json`, `Makefile`, or a `scripts/` directory — don't leave them as ad-hoc commands only in your head.
