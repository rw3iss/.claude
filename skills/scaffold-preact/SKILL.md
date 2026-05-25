---
name: scaffold-preact
description: >-
  Scaffold a Preact + TypeScript + SCSS application following a standard,
  SOLID architecture: component-based, theme-capable, service-worker-ready,
  configs isolated to a ./config directory, Rust-based tooling (Vite
  w/ Rolldown, oxlint). Run /scaffold-preact <target-dir> [notes about
  features]. Parses the user's invocation for custom requests like theming,
  animations (Motion), router, service workers, and layers them onto the base.
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
| Deployment | "docker", "deploy" | keeps `config/Dockerfile` prominent in README |

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
- Add `"motion": "^11.15.0"` to `dependencies` in `package.json`.
- In `src/app/App.tsx`, replace the placeholder heading with a `motion.h1` fade-in so the dev sees it working.

**Router (`router` / `routing`):**
- Add `"preact-router": "^4.1.2"` to `dependencies`.
- Replace `src/app/App.tsx` contents with a `<Router>` wrapping two demo routes (`/` → Home, `/about` → About) under `src/pages/`.
- Create `src/pages/Home/Home.tsx` + `src/pages/About/About.tsx` with matching `.module.scss` files.

**Service worker (`sw` / `service worker` / `offline`):**
- Create `src/services/sw/sw.ts` with a minimal `install` / `activate` / `fetch` shell (no caching strategy by default — comment-guidance instead).
- Create `src/services/sw/register.ts` exporting `registerServiceWorker()`; do NOT auto-call it in `main.tsx` — comment in `main.tsx` shows the opt-in line.
- Add a second `config/tsconfig.worker.json` targeting the SW (lib: `['ES2022', 'WebWorker']`, excluding `DOM`). Wire a `typecheck:sw` script.

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
│   │   └── App.module.scss
│   ├── components/            # reusable presentational components
│   ├── pages/                 # route-level views (if router)
│   ├── hooks/                 # custom hooks
│   ├── lib/                   # pure utilities, helpers, no Preact imports
│   ├── services/              # API clients, SW, storage, side-effecty modules
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
└── README.md
```

**Rules the scaffold embodies:**

1. **Preact + TypeScript strict** — `strict: true`, `jsx: 'react-jsx'`, `jsxImportSource: 'preact'`, path mappings for `react`/`react-dom` → `preact/compat`.
2. **Configs isolated to `config/`** — all tool configs (vite, tsconfig, oxlint, Dockerfile) live there. Scripts pass `--config config/...` / `-p config/...`. One exception: `.dockerignore` must live at project root per Docker's build-context rules; noted in README.
3. **Vite 8 bundler** — pinned `"vite": "^8.0.10"`. Vite 8 ships Rolldown (Rust bundler) built in — no aliasing / bridge package needed. Fast dev server + production bundling out of the box.
4. **SCSS architecture** — global files under `styles/`, component-scoped `*.module.scss` colocated with the component. No CSS-in-JS by default. The README notes: use inline `style={{...}}` only for values computed from runtime state that SCSS can't express (e.g., transform based on mouse position).
5. **Theme via CSS custom properties** — `_variables.scss` defines `:root { --color-bg: ...; }`. `_themes.scss` overrides under `[data-theme='dark']`. Swap at runtime by setting `document.documentElement.dataset.theme`.
6. **Responsive utilities** — `_responsive.scss` ships `@mixin mobile`, `@mixin tablet`, `@mixin desktop` and a `fluid($min, $max)` function for type-safe clamp().
7. **SOLID / composition** — `lib/` is pure (no framework imports), `services/` is side-effectful, `components/` is presentational, `hooks/` encapsulates state. Types in `src/types/` are shared across layers.
8. **Shell-first load** — `index.html` renders a minimal shell before JS hydrates. Vite 8's `modulepreload` + built-in Rolldown tree-shaking give good first-paint out of the box.
9. **Service-worker-capable** — `src/services/sw/` is reserved. If not requested, the folder is left empty except for a README pointer. If requested, stub + registration helper are added (registration is opt-in, not automatic).
10. **oxlint** — fast, permissive defaults in `config/oxlint.json`; `pnpm lint` runs on `src/`.

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
