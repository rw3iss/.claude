---
name: scaffold-preact
description: >-
  Scaffold a Preact + TypeScript + SCSS application following a standard,
  SOLID architecture: component-based, theme-capable, service-worker-ready,
  configs isolated to a ./config directory, Rust-based tooling (Vite
  w/ Rolldown, oxlint). Run /scaffold-preact <target-dir> [notes about
  features]. Parses the invocation for custom requests like theming,
  animations (Motion), router, service workers, client-side caching, and
  layers them onto the base. Can also be driven by another skill (e.g.
  design-build): honors a project's DESIGN.md, BUILD.md, and COMPONENT_INDEX.md
  plus an input query/references when provided. Uses traditional hierarchical
  SCSS (one .scss per component, real class names — no CSS modules, no
  CSS-in-JS) and tab indentation (width 4).
---

# scaffold-preact skill

Scaffolds a fresh Preact + TypeScript + SCSS application into a directory the user specifies. Built to be extensible (service workers, routing, animations) but delivered with a small, composable core.

---

## Invocation

```
/scaffold-preact <target-dir> [free-form notes about features]
```

Examples the user may type:

- `/scaffold-preact ~/Sites/foo` — scaffold at `~/Sites/foo`, defaults only.
- `/scaffold-preact ./my-app with dark theme and animations` — add theming + Motion.
- `/scaffold-preact portfolio --router --sw` — include preact-router + a service-worker stub.
- `/scaffold-preact .` — scaffold into current directory (confirm if non-empty).

---

## Inputs from a calling skill (e.g. design-build)

This skill can be invoked directly by a user **or** delegated to by another skill
that needs a fresh Preact app built to a project's specifications. When delegated,
accept and honor any of these inputs (all optional except a target path):

| Input | What to do with it |
|---|---|
| **Target / project path** | Where to scaffold (same as the positional arg). Resolve and scaffold there. |
| **`DESIGN.md`** (path or content) | Design rules — tokens, color ramp, typography, spacing/radii, aesthetic, motion. **Apply it to the scaffold:** set `styles/_variables.scss` (and `_themes.scss`, font stacks) from these tokens instead of the generic defaults. Do not invent a look that contradicts it. |
| **`BUILD.md`** (path or content) | Build rules — project structure, code-quality, tooling conventions. Follow them; if they conflict with a default here, the project's BUILD.md wins. |
| **`COMPONENT_INDEX.md`** (path or content) | A reuse manifest of components/utilities/styles. For a brand-new app it's usually empty; if it lists existing pieces (scaffolding into an established context), don't recreate them. |
| **Input query / objective** | Free-form description of the app/feature. Use it the same way you parse a user's invocation notes (theming, router, caching, etc.) and to name things. |
| **Reference images** | Optional visual reference for the aesthetic. Use to inform tokens/typography only; this skill scaffolds structure, it does not pixel-replicate (that's the caller's job). |

The contract: **start from the base template, apply DESIGN.md / BUILD.md, then layer
the features implied by the query.** Produce a runnable base app; the calling skill
fills in feature-specific components afterward.

---

## What to parse from the user's message

Parse these optional flags/phrases; if ambiguous, ask one concise question and proceed. Never block on questions about features — sensible defaults always apply.

| Feature | Trigger phrases | Effect |
|---|---|---|
| Target dir | first positional arg | `mkdir -p` the dir; write scaffold there |
| App name | `--name foo` / "called foo" / inferred from dir basename | sets `package.json` name, `<title>`, README heading |
| Theming | "theme", "dark mode", "themeable", "theme toggle" | emits `styles/_themes.scss` with CSS-custom-property swap + `data-theme` attribute wiring |
| Animations | "animation", "motion", "media-heavy" | adds `motion` to deps, shows example in `src/app/App.tsx` |
| Router | "router", "routing", "multi-page", mentions >1 page | adds `preact-router` + `src/pages/` routes |
| Service worker | "sw", "service worker", "offline" | scaffolds `src/services/sw/` and registration hook (not active by default) |
| Caching | "cache", "caching", "offline data", "store responses", "indexeddb" | adds the client-side data-cache layer under `src/services/cache/` (localStorage by default; IndexedDB if asked) — see §4 |
| Deployment | "docker", "deploy" | keeps `config/Dockerfile` prominent in README |

The **UI-state persistence utility** (`src/lib/storage.ts` + `src/hooks/useUIState.ts`) ships in every scaffold regardless of what's requested — see §4.

If the user mentions a framework that conflicts with Preact (React, Vue, Svelte), stop and ask for clarification.

---

## Scaffolding steps

Work directly — you do not need to spawn a subagent for this. Use `cp -r` for the templates dir and then targeted edits for customizations.

### 1. Resolve target dir + app name

- Target dir: first positional arg. Expand `~`. If relative, resolve against the user's cwd at invocation time.
- App name: from `--name`, explicit phrase, or `basename` of target dir. Kebab-case.

If the target exists and is non-empty, ask the user to confirm overwrite before proceeding.

### 2. Copy the template

```bash
TEMPLATE="$HOME/.claude/skills/scaffold-preact/templates"
TARGET="<resolved target dir>"
mkdir -p "$TARGET"
cp -r "$TEMPLATE"/. "$TARGET"/
```

This copies: `package.json.tmpl`, `index.html.tmpl`, `README.md.tmpl`, `gitignore`, `config/*`, `src/*`, `styles/*`, `public/*`.

### 3. Rename dotfiles + tmpl suffix, substitute placeholders

- Rename `gitignore` → `.gitignore` (skill ships dotfiles un-prefixed so git + tooling don't treat them as real at the skill level).
- Rename `config/dockerignore` → `.dockerignore` at the **project root** (docker requires it at build context root, one inevitable exception to the "configs in config/" rule — noted in README).
- For each `*.tmpl` file: substitute `__APP_NAME__` with the app name, `__APP_TITLE__` with a Title-Cased version. Then remove the `.tmpl` suffix.

Bash one-liner that handles both:

```bash
cd "$TARGET"
mv gitignore .gitignore
mv editorconfig .editorconfig
mv config/dockerignore .dockerignore
find . -name '*.tmpl' -type f | while read -r f; do
    new="${f%.tmpl}"
    sed -e "s/__APP_NAME__/$APP_NAME/g" -e "s/__APP_TITLE__/$APP_TITLE/g" "$f" > "$new"
    rm "$f"
done
```

### 4. Layer in requested features

Only modify what the user asked for. Skip silently otherwise.

**Theming (`theme` / `dark mode`):**
- Keep `styles/_themes.scss` (already in template). It defines `[data-theme='light']` / `[data-theme='dark']` blocks that override CSS custom properties declared in `_variables.scss`.
- Edit `src/main.tsx` to read persisted theme from `localStorage` and apply `document.documentElement.dataset.theme` before render.
- Add a minimal `src/hooks/useTheme.ts` returning `{ theme, setTheme, toggle }`.

**Animations (`motion` / `animations`):**
- Add `"motion": "latest"` to `dependencies` in `package.json`.
- In `src/app/App.tsx`, replace the placeholder heading with a `motion.h1` fade-in so the dev sees it working.

**Router (`router` / `routing`):**
- Add `"preact-router": "^4.1.2"` to `dependencies`.
- Replace `src/app/App.tsx` contents with a `<Router>` wrapping two demo routes (`/` → Home, `/about` → About) under `src/pages/`.
- Create `src/pages/Home/Home.tsx` + `src/pages/About/About.tsx`, each with a matching `Home.scss` / `About.scss` imported once at the top of the component (real class names, not a module import).

**Service worker (`sw` / `service worker` / `offline`):**
- Create `src/services/sw/sw.ts` with a minimal `install` / `activate` / `fetch` shell (no caching strategy by default — comment-guidance instead).
- Create `src/services/sw/register.ts` exporting `registerServiceWorker()`; do NOT auto-call it in `main.tsx` — comment in `main.tsx` shows the opt-in line.
- Add a second `config/tsconfig.worker.json` targeting the SW (lib: `['ES2022', 'WebWorker']`, excluding `DOM`). Wire a `typecheck:sw` script.

**UI-state persistence (ALWAYS — not optional):**

Every scaffold ships a small persistence layer so components can preserve and
restore local UI state across reloads. These two files are already in the
template — leave them in and reference them:

- `src/lib/storage.ts` — a dependency-free key/value store over a swappable
  backend. **Defaults to localStorage**; a different backend (sessionStorage, an
  IndexedDB adapter, a memory stub) can be injected without touching callers.
  Exports `uiStorage` and `cacheStorage` instances.
- `src/hooks/useUIState.ts` — a `useState`-shaped hook (`useUIState(key, initial)`)
  that transparently persists through `uiStorage`. Use it for sidebar open/closed,
  active tab, density mode, sort order, dismissed banners — any view state worth
  restoring. It is NOT for server data (that's the cache layer below).

In the demo `App.tsx`, you may wire one small example (e.g. a persisted toggle)
so the dev sees it working, but keep it minimal.

**Client-side data caching (`cache` / `caching` / `offline data` / `indexeddb`):**

When caching is requested, add a cache layer for data services so fetched data is
stored and reused (and survives reloads):

- Create `src/services/cache/cache.ts` — a small TTL cache built on `cacheStorage`
  from `lib/storage`: `get<T>(key)`, `set<T>(key, value, ttlMs?)`, `remove(key)`,
  and a `getOrFetch<T>(key, loader, ttlMs?)` that returns the cached value when
  fresh and otherwise calls `loader()`, caches, and returns it.
- Create `src/hooks/useCachedResource.ts` — a hook wrapping `getOrFetch` that
  returns `{ data, loading, error, refresh }` for use in components.
- **Backend:** default to **localStorage** (via `cacheStorage`). Only if the user
  asks for IndexedDB (or mentions large/offline datasets) implement an
  `IndexedDBBackend` (`StorageBackend` from `lib/storage`) and construct a
  `Storage` instance with it for `cacheStorage`. Note the choice in the README.
- Wire any data service the scaffold creates to read through the cache, so adding
  a new data source automatically benefits from caching.

If caching is **not** requested, still ship `lib/storage.ts` + `useUIState.ts`
(UI state is always persisted); just skip `src/services/cache/`.

### 5. Install deps

Detect the user's preferred package manager:

1. If `pnpm-lock.yaml` exists in an ancestor dir → use `pnpm`.
2. Else if a sibling project under the parent dir uses `pnpm` or `yarn` → match it.
3. Else default to `pnpm` (fast, modern).

```bash
cd "$TARGET"
pnpm install  # or npm install / yarn
```

If the install fails (e.g., no internet, no pnpm installed), report the error and move on — scaffold is still usable, user can install later.

### 6. Report

Print a concise summary:

- Where the scaffold landed.
- What was enabled (theming / motion / router / SW).
- The three commands to run: `pnpm dev`, `pnpm build`, `pnpm lint`.
- That configs live in `config/` (reference `pnpm dev` = `vite --config config/vite.config.ts`).

---

## Architecture the scaffold enforces

**Directory layout** (final scaffold):

```
<target>/
├── config/
│   ├── vite.config.ts         # bundler config (Vite 8, Rolldown built in)
│   ├── tsconfig.json          # shared base
│   ├── tsconfig.app.json      # app code
│   ├── tsconfig.node.json     # vite.config + tooling
│   ├── oxlint.json            # Rust-based linter
│   └── Dockerfile             # multi-stage static build
├── public/                    # static assets copied as-is
├── src/
│   ├── main.tsx               # entry — mounts <App />
│   ├── app/                   # App shell (root layout, providers)
│   │   ├── App.tsx
│   │   └── App.scss           # imported once in App.tsx; real class names
│   ├── components/            # reusable presentational components (Component.tsx + Component.scss)
│   ├── pages/                 # route-level views (if router)
│   ├── hooks/                 # custom hooks
│   │   └── useUIState.ts      # persisted UI state (always shipped)
│   ├── lib/                   # pure utilities, helpers, no Preact imports
│   │   └── storage.ts         # localStorage-backed key/value store (always shipped)
│   ├── services/              # API clients, SW, storage, side-effecty modules
│   │   └── cache/             # client-side data cache (only when caching requested)
│   └── types/                 # shared type definitions
├── styles/                    # global SCSS
│   ├── _variables.scss        # design tokens as CSS custom properties
│   ├── _themes.scss           # theme overrides (if theming)
│   ├── _mixins.scss           # reusable SCSS functions (fluid(), clamp helpers)
│   ├── _responsive.scss       # @mixin mobile / tablet / desktop
│   ├── _reset.scss            # minimal modern CSS reset
│   └── global.scss            # barrel — imports all of the above
├── index.html
├── package.json
├── .gitignore
├── .dockerignore
├── .editorconfig              # tab indentation, width 4 (enforced editor-wide)
└── README.md
```

**Rules the scaffold embodies:**

1. **Preact + TypeScript strict** — `strict: true`, `jsx: 'react-jsx'`, `jsxImportSource: 'preact'`, path mappings for `react`/`react-dom` → `preact/compat`.
2. **Configs isolated to `config/`** — all tool configs (vite, tsconfig, oxlint, Dockerfile) live there. Scripts pass `--config config/...` / `-p config/...`. One exception: `.dockerignore` must live at project root per Docker's build-context rules; noted in README.
3. **Vite 8 bundler** — pinned `"vite": "^8.0.10"`. Vite 8 ships Rolldown (Rust bundler) built in — no aliasing / bridge package needed. Fast dev server + production bundling out of the box.
4. **SCSS architecture (traditional, not modules)** — global files under `styles/`; each component has a colocated `Component.scss` imported once at the top of the component (`import './Component.scss';`) purely for its side effect. Markup uses **real, hierarchical class names** (`class="card"`, nested `.card__title` / `&:hover` selectors) — **not** a hashed-classname JS object. No CSS modules. No CSS-in-JS unless genuinely necessary: use inline `style={{...}}` only for values computed from runtime state that SCSS can't express (e.g., a transform based on mouse position). Namespacing is by convention (BEM-ish or a top-level component class), not by build-time hashing.
5. **Theme via CSS custom properties** — `_variables.scss` defines `:root { --color-bg: ...; }`. `_themes.scss` overrides under `[data-theme='dark']`. Swap at runtime by setting `document.documentElement.dataset.theme`.
6. **Responsive utilities** — `_responsive.scss` ships `@mixin mobile`, `@mixin tablet`, `@mixin desktop` and a `fluid($min, $max)` function for type-safe clamp().
7. **SOLID / composition** — `lib/` is pure (no framework imports), `services/` is side-effectful, `components/` is presentational, `hooks/` encapsulates state. Types in `src/types/` are shared across layers.
8. **Shell-first load** — `index.html` renders a minimal shell before JS hydrates. Vite 8's `modulepreload` + built-in Rolldown tree-shaking give good first-paint out of the box.
9. **Service-worker-capable** — `src/services/sw/` is reserved. If not requested, the folder is left empty except for a README pointer. If requested, stub + registration helper are added (registration is opt-in, not automatic).
10. **oxlint** — fast, permissive defaults in `config/oxlint.json`; `pnpm lint` runs on `src/`.
11. **Indentation = tabs (width 4)** — all generated code, configs, and styles use tab indentation, enforced project-wide by `.editorconfig` (`indent_style = tab`, `tab_width = 4`). Any code you write or format for this scaffold must use tabs, not spaces.
12. **Client-side persistence** — UI preferences/state persist via `src/hooks/useUIState.ts` over `src/lib/storage.ts` (localStorage by default; always shipped). Server/data responses cache via `src/services/cache/` when caching is enabled (localStorage by default, IndexedDB on request). The storage backend is swappable in one place.

---

## After scaffolding

The user gets:

```
cd <target>
pnpm dev        # http://localhost:5173
pnpm build      # → dist/
pnpm preview    # serve dist/
pnpm lint       # oxlint src/
pnpm typecheck  # tsc --noEmit
```

Dockerized production build:

```
docker build -f config/Dockerfile -t <app-name> .
docker run -p 8080:80 <app-name>
```

---

## Non-goals

- Not a full design system — UI primitives are the user's problem.
- Not a state-management decision — user picks (signals, context, zustand-for-preact, etc.) as they grow.
- Not a test setup — tests are deferred to a separate skill/phase.
- Not backend code — frontend scaffold only.
