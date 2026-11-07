---
name: build
description: >-
  Build or extend a Preact + TypeScript + SCSS app from a page/feature request.
  The gateway for "build the app", "add a settings page", "build a comments
  widget", "add a component", "extend the app". Reads DESIGN.md (design rules,
  tokens, aesthetic) and BUILD.md (build/code rules) when present, and the
  COMPONENT_INDEX.md reuse manifest, then either scaffolds a new app (when none
  exists) or extends the existing one in place — analyzing the request, reusing
  existing components, utilities, and styles before creating anything new.
  Reference images are optional and used only when supplied. Also bootstraps an
  existing project with standalone DESIGN.md / BUILD.md / COMPONENT_INDEX.md rule
  files (no code) on requests like "generate a BUILD.md" or "bootstrap this repo".
  Does not produce backend code or tests.
---

# Build skill

The gateway for building new pages and features into a Preact + TypeScript + SCSS
app. It figures out **what to build**, **where** (new app vs. extend the existing
one), and **how** (the app's own design + build rules), and it reuses what already
exists before creating anything new.

It is **design-rules-first, not image-first.** Reference images are optional —
most invocations won't have any. The authoritative inputs are the project's
`DESIGN.md`, `BUILD.md`, and `COMPONENT_INDEX.md`.

## What it reads (in priority order)

1. **`DESIGN.md`** (walked up from CWD) — design rules: tokens, theme, typography, component design, aesthetic. **Always consulted when present.**
2. **`BUILD.md`** (walked up from CWD) — build rules: project structure, code quality, tooling. **Always consulted when present.**
3. **`COMPONENT_INDEX.md`** (at the app root) — the reuse manifest of existing components, shared utilities/hooks, and shared SCSS. Read **before** building anything.
4. **Reference images** — optional; used only if the user supplies a folder, file paths, or indices from a prior `design` run.
5. **The request** — the page/feature/component to build, plus any extra guidance.

## Target: new app vs. extend (CWD is the project)

The build target is the **current project**, resolved by `resolve_target.ts`:

- Walk up from CWD for the nearest `package.json` (stopping at the `.git` boundary).
  - **Found → extend** that app in place.
  - **Not found → new**; scaffold a new app at the CWD.
- **Explicit phrasing overrides detection:** "start fresh" / "new app" → new;
  "add" / "extend" / "new page" / "new component" → extend.
- An explicit target path (if the user gives one) overrides everything.

Default behavior is loose and leans toward **extend** — building into the existing
codebase is the common case.

## Flow

1. **Resolve the target** — run `resolve_target.ts` with `projectCwd` and the
   `intent` you inferred (`auto` | `new` | `extend`). It returns `appRoot`,
   `operation`, and whether `DESIGN.md` / `BUILD.md` / `COMPONENT_INDEX.md` exist.
2. **Resolve images (only if the user supplied any)** — call `select_images.ts`
   (modes A/B/C below) and capture `imagePaths`. Skip entirely when there are none.
3. **Write the build brief** — run `build_plan.ts`. It reads DESIGN.md, BUILD.md,
   and COMPONENT_INDEX.md, folds in the request and any images, and writes
   `<appRoot>/PLAN.md` (regenerated each run; gitignored in scaffolded apps).
4. **Scaffold (new app only) — delegate to `scaffold-preact`.** If
   `operation === "new"`, **invoke the `scaffold-preact` skill** (Skill tool:
   `scaffold-preact`) to lay down the base app, rather than scaffolding by hand.
   See [Delegated scaffolding](#delegated-scaffolding-new-apps) below for exactly
   what to pass. After it returns, **layer build's essentials on top**:
   - Ensure the mandatory **mock-data layer** exists (`ApiClient` +
     `MockApiAdapter` + `src/mock/data/*.json`) — see below.
   - Seed `DESIGN.md` / `BUILD.md` / `COMPONENT_INDEX.md` if still absent (so the
     project is self-describing for later builds).

   For `extend`, do **not** scaffold.
5. **Analyze, then build** — follow `PLAN.md`. Do the mandatory feature analysis
   and reuse-match (below) before writing code, then implement.
6. **Update the index + docs** — add/refresh `COMPONENT_INDEX.md` rows for every
   new shared component, utility, or SCSS mixin/class, and note notable new shared
   surface in the README / CLAUDE.md.

## Delegated scaffolding (new apps)

When `operation === "new"`, build does **not** hand-roll the framework — it
delegates to the **`scaffold-preact`** skill and then customizes the result with
this project's request. The base scaffold (Preact + TS + traditional SCSS, configs
in `config/`, tab indentation, a persisted UI-state utility, optional caching) is
`scaffold-preact`'s job; the design intent and the feature are build's.

**Invoke `scaffold-preact`** (via the Skill tool) with:

| Pass | Value |
|---|---|
| target / project path | `appRoot` (from `resolve_target.ts`) |
| `DESIGN.md` | the resolved `designMdPath` (if any) — so it sets tokens/typography from the design rules instead of generic defaults |
| `BUILD.md` | the resolved `buildMdPath` (if any) — so it follows the project's structure/tooling rules |
| `COMPONENT_INDEX.md` | the resolved `componentIndexPath` (if any) |
| input query | the build objective + any extra guidance (drives feature parsing: theme, router, caching, etc.) |
| reference images | `imagePaths` (if any) — aesthetic reference only |

Then continue with build's own steps (mock-data layer, then build the
feature per `PLAN.md`). `scaffold-preact` produces a runnable base; build
fills in the feature-specific components.

**Fallback.** If the `scaffold-preact` skill isn't installed/available, fall back
to the bundled `scaffold_preact.ts` script (`targetDir = appRoot`). Its template is
a mirror of the `scaffold-preact` base (same configs-in-`config/`, traditional
SCSS, tab indentation, persisted UI-state utility in `src/lib/storage.ts` +
`src/hooks/useUIState.ts`) plus build's mandatory mock-data layer and the
starter `DESIGN.md` / `BUILD.md` / `COMPONENT_INDEX.md` (never clobbering existing
ones).

## Mandatory: feature analysis → reuse-match (before any code)

`PLAN.md` carries the full protocol; the contract is:

1. **High-level analysis** — the feature's goal/objective and where it fits.
2. **Granular/technical analysis** — decompose into discrete pieces: UI sections,
   interactive elements, data, states (loading/empty/error), shared behavior.
3. **Reuse-match against `COMPONENT_INDEX.md`** — for each piece, decide
   **reuse** (use as-is) / **adapt** (extend an existing component, util, or mixin)
   / **new** (only when genuinely unique). Layout components and page elements
   count. Everything reusable gets reused.
4. **Default to modular** — break sections and elements into discrete,
   single-purpose, reusable components rather than inlining large blocks. New
   component layouts are for the genuinely unique parts only.
5. **Place it correctly** — a **page** (route/screen) → `src/pages/<PageName>/`; a
   **feature/UI component** → `src/components/<feature-or-component>/`; a
   **primitive/core "common" component** (Button, Input, Modal, …) →
   `src/components/common/<Component>/`. Never dump everything flat into `src/components/`.

## DRY — non-negotiable

Never duplicate a token, mixin, SCSS class, utility, or component. Extend the
existing one (add a prop/variant/parameter) instead of cloning. All colors,
spacing, and radii come from CSS custom properties — `var(--color-*)` /
`var(--space-*)` / `var(--radius-*)`; all fonts from `var(--font-*)`. No raw
values or raw `font-family` strings in component SCSS.

## Reference images (optional)

When images are supplied, `build_plan.ts` adds an image protocol governed by
`imageFollowMode`:

| Mode | When | Behavior |
|---|---|---|
| `exact` (default) | "build this", "replicate" | Zone-by-zone inventory, then replicate layout faithfully — but still route all values through the app's tokens |
| `creative` | "be creative", "use as inspiration", "go further" | Treat images as a mood board; invent a bolder layout in the same spirit using existing tokens/components |

With no images, neither protocol is emitted — the build follows DESIGN.md +
existing code instead.

## Mandatory: the mock-data layer

Every app exposes `src/services/api/ApiClient.ts` (interface) and
`src/services/api/index.ts` (the single injection point wiring in
`MockApiAdapter`). Any data a feature shows is added as `ApiClient` methods,
implemented in `MockApiAdapter`, and backed by realistic `src/mock/data/*.json`
fixtures. The feature must demo with no backend and no env vars. Swapping to a
real backend is a one-line change in `index.ts`.

## COMPONENT_INDEX.md — the reuse manifest

App-root markdown the skill creates and maintains. Three tables — **Components**,
**Shared utilities & hooks**, **Shared SCSS (mixins · classes · tokens)** — each
row: `path · one-line purpose · reuse-for hint`. It is the contract every build
reads first and updates last.

## Bootstrap an existing project (docs only, no code)

Sometimes the user just wants to **establish the rule files** in a project without
building anything — "give this project a BUILD.md", "generate a DESIGN.md for my
app", "bootstrap this repo with build docs". Triggers: "bootstrap", "just
generate a BUILD.md / DESIGN.md", "set up the docs", "no code".

Run `bootstrap_docs.ts` — it drops the template stubs (`DESIGN.md` / `BUILD.md` /
`COMPONENT_INDEX.md`) into the target project and **nothing else** (no scaffold, no
components, no `npm install`). It's no-clobber by default; pass `overwrite: true`
to regenerate.

After generating, **tailor the stub to the actual project**: read its
`package.json`, configs, `src/` structure, and any existing `CLAUDE.md` /
`README.md`, then fill the Stack / Project structure / project-specific rule
sections with what's really true, and fold in any rules from an older
`BUILD.md`/`DESIGN.md` you're replacing. The template carries the enforced
defaults (SOLID, hoist/centralize, lazy-loading non-blocking components,
100ms-throttled inputs, COMPONENT_INDEX upkeep, README data-layer note); your job
is to make the project-specific parts accurate.

```jsonc
{ "projectDir": "/path/to/project", "docs": ["build"], "appName": "my-app", "overwrite": false }
// docs: any of ["design","build","index"], or "all"
// → { "status": "ok", "written": ["…/BUILD.md"], "skipped": [], "appName": "my-app" }
```

## Commands

| Script | Purpose |
|---|---|
| `resolve_target.ts '<json>'` | Resolve `appRoot` + new/extend operation + which rule files exist |
| `select_images.ts '<json>'` | Resolve reference image paths — only when images are supplied |
| `build_plan.ts '<json>'` | Read the rules, write `<appRoot>/PLAN.md` |
| `bootstrap_docs.ts '<json>'` | Docs-only bootstrap: write `DESIGN.md` / `BUILD.md` / `COMPONENT_INDEX.md` stubs into a project, no code (see [Bootstrap](#bootstrap-an-existing-project-docs-only-no-code)) |
| `scaffold_preact.ts '<json>'` | **Fallback only.** New-app scaffolding normally delegates to the `scaffold-preact` skill (see [Delegated scaffolding](#delegated-scaffolding-new-apps)); use this bundled script only when that skill isn't available |

### `resolve_target.ts`

```jsonc
{ "projectCwd": ".", "intent": "auto", "target": null }
// intent: "auto" (detect) | "new" (force scaffold) | "extend" (force add)
// → { "appRoot": "...", "operation": "new"|"extend", "appFound": bool,
//     "designMdPath": "..."|null, "buildMdPath": "..."|null, "componentIndexPath": "..."|null }
```

### `select_images.ts` (optional)

```jsonc
{ "mode": "indices", "imagesDir": "designs/checkout/images", "indices": [2, 4], "preferUpscaled": false } // A — prior design run
{ "mode": "dir", "dir": "/path/to/any/image/folder" }                                                    // B — any folder
{ "mode": "paths", "paths": ["/abs/img1.png", "/abs/img2.jpg"] }                                          // C — explicit paths
// → { "status": "ok", "imagePaths": ["..."] }
```

### `build_plan.ts`

```jsonc
{
  "request": "settings-page",       // short name of the feature/page
  "projectCwd": ".",                // root for target resolution + rule-file walk-up
  "objective": "add a settings page with profile + notifications", // the ask
  "extraPrompt": "match the existing card style", // optional extra guidance
  "intent": "auto",                 // "auto" | "new" | "extend"
  "target": null,                   // optional explicit app dir
  "imagePaths": [],                 // optional; from select_images
  "imageFollowMode": "exact"        // "exact" (default) | "creative" — only used when imagePaths is non-empty
}
// → writes <appRoot>/PLAN.md; returns { planPath, appRoot, operation, ... }
```

### `scaffold_preact.ts` (new app only, if /scaffold-preact skill is not available)

```jsonc
{ "targetDir": "<appRoot>", "appName": "acme" }
// Seeds the framework + mock layer + starter DESIGN.md / BUILD.md / COMPONENT_INDEX.md / .gitignore
// (never overwriting existing copies of those root docs).
```

## Shared utilities

`shared.ts` re-exports path/name helpers (`toRequestName`, `findDesignMd`,
`readIfExists`) from `../design/lib/`, plus the target resolver
(`resolveTarget`, `findAppRoot`). The **design workflow** need not have run —
only the shared library files must be present. Both skills install together.
