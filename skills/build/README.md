# build (Claude Code skill)

The gateway for building new pages and features into a Preact + TypeScript + SCSS
app. It decides **what** to build, **where** (scaffold a new app vs. extend the
existing one), and **how** (the app's own `DESIGN.md` + `BUILD.md` rules), and it
**reuses existing components and styles before creating anything new**.

Design-rules-first, not image-first — reference images are optional. Installed by
the `design-build-skills` installer.

---

## How it decides what to do

On every request the skill resolves a **target** by walking up from your current
directory for the nearest `package.json` (stopping at the `.git` boundary):

- **App found → extend it in place** (add the page / feature / component).
- **No app found → scaffold a new app** at the current directory.

This is loose by design and leans toward extending. Explicit phrasing overrides
detection — "start fresh" / "new app" forces new; "add" / "extend" / "new page"
forces extend.

---

## What it reads

| Input | Role | Required? |
|---|---|---|
| `DESIGN.md` | design rules: tokens, theme, typography, aesthetic | Read when present (walked up from CWD) |
| `BUILD.md` | build rules: structure, code quality, tooling | Read when present (walked up from CWD) |
| `COMPONENT_INDEX.md` | reuse manifest of existing components / utils / styles | Read first, updated last |
| reference images | extra visual reference | Optional — only when you supply them |
| the request | the page/feature/component to build | Required |

New apps get starter `DESIGN.md`, `BUILD.md`, and `COMPONENT_INDEX.md` seeded
automatically (existing copies are never overwritten), so the project becomes
self-describing for later builds.

---

## Feature analysis → reuse, then build

Before writing code, the skill analyzes the request at two levels and matches it
against the reuse manifest:

1. **High level** — the feature's goal/objective.
2. **Granular level** — the discrete pieces: UI sections, interactions, data,
   states (loading/empty/error).
3. **Reuse-match** against `COMPONENT_INDEX.md` — for each piece, **reuse** an
   existing component/util/style, **adapt** one (extend it rather than clone), or
   create **new** only when genuinely unique. Layout pieces and page elements count.
4. **Modular by default** — sections are broken into discrete, reusable components
   instead of large inlined blocks.

**DRY is non-negotiable:** no duplicated tokens, mixins, classes, utilities, or
components; values come from CSS custom properties — `var(--color-*)` /
`var(--space-*)` / `var(--radius-*)` — and fonts from `var(--font-*)`.

After building, the skill updates `COMPONENT_INDEX.md` and notes any notable new
shared component/util/style in the README / CLAUDE.md.

---

## Reference images (optional)

Supply images via a folder, explicit file paths, or indices from a prior
`design` run. Two follow modes:

| Mode | When | What changes |
|---|---|---|
| `exact` (default) | "build this", "replicate" | Zone-by-zone inventory, faithful layout — values still routed through the app's tokens |
| `creative` | "be creative", "use as inspiration" | Images as a mood board; a bolder layout in the same spirit using existing tokens/components |

With no images, the build follows `DESIGN.md` + the existing code instead.

---

## Mock-data layer (mandatory)

Every app ships `src/services/api/ApiClient.ts` (interface) and
`src/services/api/index.ts` wired to `MockApiAdapter`. Any data a feature shows is
added as `ApiClient` methods, implemented in the mock adapter, and backed by
`src/mock/data/*.json` fixtures. The result demos with no backend. Swapping to a
real backend is a one-line change:

```typescript
// src/services/api/index.ts
import type { ApiClient } from "./ApiClient";
import { HttpApiAdapter } from "./HttpApiAdapter"; // your new file
export const apiClient: ApiClient = new HttpApiAdapter(import.meta.env.VITE_API_BASE);
```

---

## Output

- **Extend:** new components/pages land in your existing app under its conventions.
- **New:** the base app is scaffolded by delegating to the **`scaffold-preact`** skill (passing this project's `DESIGN.md` / `BUILD.md` / `COMPONENT_INDEX.md` + the request), then build adds the mock-data layer and builds the requested feature into it.
- A regenerated `PLAN.md` (the per-build brief) is written to the app root and is gitignored.

---

## Scripts

| Script | Purpose |
|---|---|
| `resolve_target.ts` | Resolve app root + new/extend operation + which rule files exist |
| `select_images.ts` | Resolve reference image paths (only when images are supplied) |
| `build_plan.ts` | Read the rules, write `<appRoot>/PLAN.md` |
| `scaffold_preact.ts` | **Fallback only** — new-app scaffolding normally delegates to the `scaffold-preact` skill; this bundled script is used only when that skill isn't installed |

> New-app scaffolding delegates to the separate **`scaffold-preact`** skill, which
> produces the Preact + TS + traditional-SCSS base (tabs, persisted UI-state
> utility, optional client-side caching). build customizes the result with
> the project's design rules and the requested feature.

See [`SKILL.md`](./SKILL.md) for the exact argument shapes.

---

## Updating

From inside Claude Code, just run **`/build update`** — it runs the installer's
`--update` to refresh both skills *and* the `/design` + `/build` commands. No restart
needed: Claude Code hot-reloads skills and commands from disk. Equivalent on the CLI:
`~/.cache/design-build-skills/install.sh --update` (or `npm run update` from a clone).
See the [repo README](../../README.md#updating) for all methods.

---

## Running tests

```bash
cd ~/.claude/skills/build
npm test
```
