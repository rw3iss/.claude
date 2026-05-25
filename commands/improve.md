# Improve the project (UI, UX, architecture, code quality)

Perform a thorough improvement pass over the current active project.
This command looks for opportunities to make the application more
professional, refined, powerful, clever, and maintainable — without
breaking existing functionality. The goal is to *extend* what's
already there: consolidate duplicated code, unify inconsistent UI,
make custom components more reusable and configurable, and push
overall architecture toward clean SOLID principles.

This is a multi-stage workflow. Each stage produces an audit
document first, presents it to the user, and only applies changes
after confirmation where appropriate.

## Workflow

### 1. Discover the project

- Detect project type, languages, frameworks, build tooling, and
  directory layout. Read any `CLAUDE.md`, `AGENTS.md`, `README.md`,
  or equivalent project-local instruction files. Respect them — if
  they contradict this command, follow the project instructions and
  note the conflict.
- Identify the major architectural boundaries (client, server, CLI,
  shared libraries, data, tools, plugins, etc.) so improvements
  can be scoped per area.
- Read the existing `package.json` / `go.mod` / `Cargo.toml` /
  equivalent to understand dependencies and scripts already in use.
  Prefer improvements that leverage existing tooling over adding
  new dependencies.

### 2. UI & UX audit (client-facing components)

Analyze the user interface and general usability. For each area,
look for concrete, actionable improvements:

- **Layout & hierarchy.** Inconsistent spacing, misaligned
  elements, competing visual weights, cramped or empty regions,
  missing visual rhythm, unclear information density. Note any
  screens where the hierarchy is confusing.
- **Component consistency.** Buttons, inputs, dropdowns, modals,
  toasts, tooltips, cards, lists, filters, tables — are they
  styled and behaving consistently across views? Are there
  multiple slightly-different implementations of the same
  conceptual widget that should be unified into one shared
  component?
- **Custom controls — make them more powerful.** For every custom
  component in the codebase, ask:
  - Could it accept more props / slots / children to become
    reusable elsewhere?
  - Is its API minimal and composable, or does it hardcode
    behavior that belongs to the parent?
  - Could it be split into a "headless" logic layer plus a
    "styled" presentational layer, so the logic is reusable with
    different visuals?
  - Are there duplicate components that should be merged into
    one generic component with configuration variants?
- **Interaction polish.** Missing hover/focus/active/disabled
  states, slow or missing transitions, keyboard accessibility
  gaps, touch-target sizing, loading/empty/error states, copy
  quality, icon consistency.
- **Information architecture.** Navigation clarity, step flow in
  wizards, discoverability of important actions, labels that
  match user intent, hidden functionality that should be
  surfaced.
- **Admin / backend / developer UI.** Apply the same lens to any
  admin panels, settings screens, debug views, or internal
  tools. They deserve the same care as user-facing screens.
- **Responsiveness.** Breakpoints, overflow handling, mobile
  layouts where applicable.

For each finding, record: **what's wrong, where it lives (file:line),
why it matters, and the proposed fix.**

### 3. Styling architecture audit

Evaluate the styling approach across the project:

- **Global design tokens.** Are colors, spacing, radii, shadows,
  font sizes, breakpoints, transitions, z-indexes defined as CSS
  custom properties (or equivalent)? Are they used consistently,
  or are magic values hardcoded inline? Propose a unified token
  set if one doesn't exist.
- **Themeability.** Can the whole app be re-themed by changing a
  handful of variables? If not, what's blocking that?
- **Style encapsulation.** Are styles scoped correctly (CSS
  modules, scoped styles, styled-components, BEM, Tailwind,
  SCSS modules)? Are there leaks between components? Is there
  a mix of conventions that should be consolidated?
- **Shared SCSS / CSS utilities.** Look for duplicated CSS
  patterns that belong in shared mixins, utility classes, or
  base styles.
- **Inline styles.** Flag heavy inline styling that should move
  to stylesheets, especially when the same inline pattern is
  repeated across files.
- **Dark/light mode & high-contrast.** Note whether the app has
  a coherent light/dark story, or whether half the components
  assume one color scheme.

Propose a concrete, unified styling architecture if the current
state is fragmented. Do not invent a brand new design system — use
what's already there and extend it.

### 4. Code architecture audit (SOLID & reusability)

Look for structural improvements across both backend and frontend:

- **Single Responsibility.** Functions/classes/modules doing too
  many unrelated things. Suggest extracting responsibilities
  into smaller focused units.
- **Duplication.** Near-identical logic in multiple places —
  collapse into shared utilities, base classes, hooks, or
  composables.
- **Open/Closed.** Places where adding a new case requires
  editing existing code instead of plugging in a new
  implementation. Consider strategy patterns, registries,
  plugin points.
- **Liskov / Interface Segregation.** Overly broad interfaces
  that force consumers to implement methods they don't need.
  Split them.
- **Dependency Inversion.** High-level modules depending on
  low-level modules directly. Consider introducing abstractions
  or dependency injection where it simplifies testing and
  extension.
- **Cross-cutting concerns.** Logging, error handling,
  validation, authentication, caching — are they handled
  consistently, or sprinkled ad-hoc?
- **Module boundaries.** Is the split between client/server/
  shared code clean? Are types shared correctly between tiers?
  Are there imports that cross boundaries inappropriately?
- **File organization.** Files in the wrong folder, inconsistent
  naming, missing barrel exports, deep import paths that should
  be aliased.
- **Dead code & stale comments.** Note them but do not delete
  in this pass — defer to `/dead-code` for safe removal.

For each architectural improvement, record: **the current problem,
the proposed refactor, the files affected, and the risk level**
(low/medium/high based on how much behavior the change touches).

### 5. Write the audit document

Create `docs/improvement-audit-YYYY-MM-DD.md` with the following
sections. Use today's date from the environment, not a guess.

```
# Improvement Audit — YYYY-MM-DD

## 1. Summary
- Project: <name>
- Working directory: <absolute path>
- Total findings: <count> (UI: N, styling: N, architecture: N)

## 2. UI & UX improvements
  [per finding: title, location, problem, proposed fix, risk]

## 3. Styling & design system
  [per finding: ...]

## 4. Architecture & code quality
  [per finding: ...]

## 5. Recommended execution plan
  - Phase A (low risk, apply automatically): <bulleted list>
  - Phase B (medium risk, apply after user approval): <bulleted list>
  - Phase C (high risk or architectural, plan separately): <bulleted list>
```

### 6. Apply Phase A automatically (low risk)

These are safe, low-blast-radius improvements that can be applied
without explicit per-item confirmation:

- Extracting magic values into existing design tokens.
- Replacing duplicated inline styles with existing utility classes
  or shared style modules.
- Consolidating duplicate constants, types, or helper functions
  into a single shared module.
- Adding missing hover/focus/disabled visual states to existing
  components.
- Fixing obvious spacing/alignment inconsistencies that use
  existing tokens.
- Improving prop APIs on existing components to accept additional
  customization (e.g. passthrough `className`, `style`, `children`,
  common event handlers) without changing default behavior.
- Small renames and file moves that purely improve organization.

After each edit, re-run the project's build / type-check
(`tsc --noEmit`, `go build ./...`, `cargo check`, etc.) to confirm
nothing broke. If a build fails, revert the last change, record
the failure in the audit, and continue.

Do not commit the changes — leave them staged in the working tree
for the user to review.

### 7. Present Phase B for approval (medium risk)

Medium-risk items typically touch component APIs or shared code
that multiple callers depend on. Show the user:

- The audit document path.
- A short count summary: "Applied N low-risk improvements.
  M medium-risk improvements pending approval."
- For Phase B, present an interactive list the user can accept
  individually or in groups: "Apply all? (y / N / pick items /
  show details)".

When the user approves an item, apply the change and re-verify
builds the same way Phase A does. Update the audit document to
mark the item as applied, and note any items that failed the
build (reverted).

### 8. Phase C — plan only

High-risk items (major refactors, architectural moves, data model
changes, anything that touches >10 files or changes public APIs)
should **not** be applied by this command. Instead:

- Leave them documented in the audit under "Phase C — planned".
- Tell the user these deserve a dedicated planning session and
  recommend running `/implement` or the `superpowers:writing-plans`
  skill to turn them into a proper implementation plan.

### 9. Documentation sync

Every applied improvement (Phase A and approved Phase B items)
must keep the project's user-facing documentation in step. Before
declaring a phase complete:

- **Locate documentation surfaces.** `README.md`, `README.*`,
  `docs/**`, `wiki/**`, a separate `docs-site/` or `website/`
  directory, in-repo `CHANGELOG.md`, JSDoc/godoc/Sphinx output
  configs, anything declared in `package.json` `homepage` /
  `repository.docs`, and any external documentation site whose
  source lives in the repo.
- **Diff what the user sees.** For each applied improvement,
  ask:
  - Did a public API signature change? Update API docs +
    examples.
  - Did a CLI flag, subcommand, environment variable, config
    key, keybind, or screen flow change? Update the usage /
    keys / configuration sections.
  - Did a default value change (theme name, timeout, port,
    cache TTL, etc.)? Update the configuration reference.
  - Did a screenshot or terminal capture become stale because
    of UI changes? Note it in the audit; do not regenerate
    images automatically.
  - Did install / update / uninstall instructions change?
    Update them. Verify any one-line install URLs still
    point at the right path.
  - Did a feature gain / lose capability? Update the feature
    list, feature flags, and the introduction paragraph.
- **Apply the documentation updates** in the same working tree,
  alongside the code changes. Re-run any docs build the project
  exposes (`mkdocs build`, `npm run docs`, `cargo doc`, etc.) to
  confirm the docs still render.
- **Record what was updated** in the audit under each finding
  ("Docs updated: README.md §Usage, docs/keys.md") so the user
  can review the doc changes alongside the code changes.

If the project has no user-facing docs yet, skip this step but
note the absence in the audit summary so the user knows.

This is not optional for any change that affects:

- public APIs / exported functions / types
- CLI surface (commands, flags, env vars, config keys)
- keybinds, screen flow, default behavior visible to users
- install / update / build / deploy procedures
- supported platforms, Go/Node/etc minimum versions
- visible UI labels, copy, or screenshots referenced in docs

Internal refactors (file moves, helper extractions, code-quality
cleanups that the user never sees) do **not** require doc updates.
Use judgment.

## Hard rules

- **Break existing functionality only when refactoring genuinely
  requires it.** Default to preserving current behavior. When a
  cleaner architecture forces a breaking change (renamed exports,
  restructured signatures, removed indirection), it's allowed
  provided:
  1. The previous user-visible goal or result is preserved exactly,
     OR clearly improved on (faster, safer, simpler API, fixes
     a latent bug);
  2. Every affected call site is updated in the same pass so the
     build and tests pass at the end of the change;
  3. New or updated tests cover the new shape — don't rely on
     "it compiles" alone when behavior moved.
  Document the broken-vs-preserved-vs-improved deltas in the audit
  doc so a reviewer can verify the trade. If any of (1) / (2) /
  (3) isn't satisfied, the change belongs in Phase B (user
  approval) or Phase C (plan only) rather than landing
  automatically.
- **Never delete functionality.** If something looks unused, defer
  to `/dead-code`. Improvement is about extension and refinement,
  not removal.
- **Never rewrite large swaths from scratch.** Prefer surgical
  edits over sweeping rewrites.
- **Respect project conventions.** Match the existing code style,
  naming, framework idioms, and directory layout. Do not
  introduce a new styling system or state library just because
  it's trendy.
- **Do not add new dependencies** unless the user explicitly
  asks for them. Work with what's already in `package.json` /
  equivalent.
- **Do not run destructive git operations.** Changes happen as
  plain edits in the working tree. The user reviews and commits.
- **Verify before claiming success.** Every batch of changes
  must pass the project's build / type-check before moving on.
  Record verification output in the audit.
- **Respect `CLAUDE.md` and project-local instructions.** If they
  forbid something this command wants to do, skip it and note
  the conflict.
- **Keep user-facing documentation in sync.** Whenever an
  applied improvement changes a public API, CLI surface, keybind,
  default value, install/update flow, or any behavior the user
  reads about, update the corresponding `README.md`, `docs/**`,
  external docs site, and `CHANGELOG.md` (if present) in the same
  working tree. Internal-only refactors do not require this. See
  step 9 for the full checklist.

## Output expectations

- An audit document at `docs/improvement-audit-YYYY-MM-DD.md`
  listing every finding, its severity, its location, and the
  proposed fix.
- Phase A improvements applied to the working tree, with the
  project's build passing.
- An interactive prompt for Phase B items, with each accepted
  improvement applied and verified.
- Phase C items left as a written plan for the user to tackle
  separately.
- Documentation updates committed in the same working tree
  alongside any user-visible code changes (see step 9). Each
  audit finding records which docs (if any) were touched.
- A final short summary printed to the user:
  - How many improvements were applied automatically.
  - How many were applied after approval.
  - How many are deferred to Phase C planning.
  - Which documentation files were updated.
  - Path to the audit document.

## Focus areas (in priority order)

1. **Client-facing UI polish** — the parts users see every day
   deserve the most attention. Consistency, hierarchy, state
   coverage, copy, iconography, responsiveness.
2. **Shared/reusable components** — make custom controls more
   powerful and configurable so the rest of the app benefits.
3. **Design tokens & styling architecture** — unify variables,
   collapse duplication, enable themeability.
4. **Admin / developer UI** — settings pages, debug panels,
   internal tools. Hold them to the same quality bar.
5. **Code architecture** — SOLID refactors, module boundaries,
   duplication, cross-cutting concerns.
6. **Developer experience** — clearer error messages, better
   logging, inline documentation on non-obvious code.

The goal of this command is to leave the project meaningfully
better after each run: more professional, more consistent, more
reusable, more maintainable — while keeping everything that
currently works exactly as it was.
