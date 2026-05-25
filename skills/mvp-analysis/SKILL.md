---
name: mvp-analysis
description: Audit a codebase end-to-end for MVP-readiness — features, architecture, UI/UX, branding, product polish — and write a hierarchical, collapsible MVP_PLAN.md with two prioritised checklists (easy wins vs larger lifts). Use when the user asks to plan an MVP, identify what's missing before launch, or generate an MVP roadmap. Invocation: /mvp-analysis [path]
trigger: /mvp-analysis
---

# /mvp-analysis

Walk a codebase and produce a single hierarchical document, `MVP_PLAN.md`, that lists everything the project needs to be a "real" MVP — across product features, architecture, UI, polish, branding, ops, docs. Output is organised top-down (architecture → modules → classes → small items) with collapsible sections, and each finding is bucketed into one of two checklists at the top: **Easy wins** (≤1 day each, low risk) and **Larger lifts** (multi-day / multi-PR / cross-cutting).

## Invocation

```
/mvp-analysis              # analyse current directory
/mvp-analysis <path>       # analyse another directory
/mvp-analysis . --update   # refresh an existing MVP_PLAN.md (preserve checked items)
```

The output file `MVP_PLAN.md` is always written into the **current working directory**, even when a different `<path>` is analysed (so the user keeps the plan near their terminal). If `MVP_PLAN.md` already exists, ask before overwriting; with `--update`, merge new findings while preserving any items the user has manually checked off (`- [x]`).

## What you must do when invoked

### 1. Resolve target & scope

- `target = arg or $PWD`
- Confirm `target` is a directory; if it doesn't exist, abort with a clear message.
- If the directory looks empty (no obvious project files), warn the user and ask whether to continue.

### 2. Inventory the project (cheap pass)

Spend < 60 seconds gathering context. Don't read every file. You need:

- **Stack signals**: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, `Gemfile`, `composer.json`, `*.csproj`, `Dockerfile`, `docker-compose.yml`, `Makefile`, `pnpm-workspace.yaml`, `nx.json`, `turbo.json`.
- **Entry points**: `src/main.*`, `src/index.*`, `cmd/*/main.go`, `app/`, `pages/`, `routes/`.
- **Frontend signals**: presence of `index.html`, `*.tsx/.jsx/.vue/.svelte`, `tailwind.config.*`, `vite.config.*`, design-token files, `public/` assets, `favicon`.
- **Infra signals**: `.github/workflows/`, `terraform/`, `infra/`, `k8s/`, `helm/`, `.env*`, `Procfile`, `vercel.json`, `netlify.toml`, `fly.toml`, `serverless.yml`.
- **Docs**: `README*`, `docs/`, `CHANGELOG`, `CONTRIBUTING`, `ARCHITECTURE.md`, `*.adr.md`, `LICENSE`.
- **Tests**: `*.test.*`, `*.spec.*`, `tests/`, `__tests__/`, coverage configs.
- **Modules**: top-level dirs under `src/`, `app/`, `packages/`, `services/`, `apps/` — these map to "modules" in the output.

Use the Glob and Grep tools (or `find` / `rg`) — not Read — for this pass. You only need filenames and shapes.

### 3. Drill into each layer

Walk **top-down**, from broad to narrow:

#### a) Architecture (whole-project)

Look for gaps in:

- **Build & dev loop** — does `npm run dev` / `make dev` / `cargo run` actually work? Is hot-reload set up? Is there a single command to bring up the full stack?
- **CI/CD** — workflow file present? Runs tests + lint on PR? Deploys somewhere on merge to main?
- **Env / secrets** — `.env.example` present? Secrets management documented? Production vs dev split?
- **Containerisation** — Dockerfile? `docker-compose` for local deps (db, redis)? Production image multi-stage and slim?
- **Observability** — logging library, log levels, structured logs, error tracking (Sentry/Honeybadger), metrics, healthcheck endpoint?
- **Auth** — exists? OAuth/JWT/session-based? Password reset path? Rate limiting on auth endpoints?
- **Data layer** — ORM/query layer? Migrations? Seed data? Backups documented?
- **API contract** — OpenAPI/Swagger? Typed client generated? Versioned?
- **Tests** — unit, integration, e2e? Smoke test? CI gate?
- **Documentation** — README has install/run/deploy? Architecture diagram? Onboarding guide?
- **Licensing & legal** — LICENSE file? Third-party licenses surfaced? Privacy policy / ToS pages (if user-facing)?

#### b) Modules (per-folder)

For each top-level module/service/package:

- What's its purpose? (Infer from name + entry file.)
- Is it complete enough to ship? Look for:
  - `TODO`, `FIXME`, `XXX`, `HACK`, `WIP`, `TBD` comments
  - Placeholder strings like `"replace me"`, `"my-app"`, `"foo@bar.com"`
  - Mocked services with hardcoded responses
  - Commented-out code blocks
  - `console.log`/`print()` debug statements
  - Empty exception handlers (`catch {}`, `except: pass`)
  - Hardcoded URLs, ports, credentials
  - Disabled tests (`.skip`, `xit`, `t.Skip`)
- Are its public exports documented?
- Are critical paths covered by tests?

Use `grep -rn` with the patterns above; don't read full files unless something is suspicious.

#### c) Classes / files (selective)

Only zoom in on classes/files that the module-level scan flagged as suspicious. Note them by `path:line` so the user can jump in.

Don't write a per-file paragraph for every file — that's noise. Limit to ~10-20 high-signal callouts per project.

#### d) UI / UX / Branding (frontend only)

If the project has a frontend, audit:

- **Branding**: app name consistent across `package.json`, `<title>`, README, manifest? Favicon present and not the default Vite/Next/etc. logo? OG image / social preview metadata? Logo file in repo?
- **Visual polish**: design tokens defined? Consistent spacing/colour palette? Dark mode support (if relevant)? Custom 404 / error pages?
- **States**: loading skeletons, empty states, error states for every async surface?
- **Forms**: validation messages, disabled-while-submitting, keyboard-friendly focus order?
- **A11y basics**: alt text, label/input pairing, focus-visible styles, sufficient contrast, keyboard nav?
- **Mobile**: viewport meta tag? Layouts hold up at 375px? Touch targets ≥44px?
- **Performance**: bundle analyzed? Images optimised? Code-split routes?
- **SEO**: meta description, robots.txt, sitemap, canonical URLs (for marketing/public pages)?
- **Onboarding**: first-run experience? Empty-state CTA? Tooltips/walkthrough for key features?

#### e) Product polish & launch readiness

- Landing page exists (if needed)?
- Pricing / billing flow (if SaaS)?
- Email/notification templates use real branding, not placeholders?
- Error tracking captures errors with user/session context?
- Status page / uptime monitoring?
- Domain + SSL plan?
- Analytics (privacy-respecting if EU users)?
- Feedback channel (in-app / Discord / email)?

### 4. Bucket every finding into one of two priorities

A finding is an **Easy win** if all of:
- Effort ≤ 1 working day for one developer
- No design or product decision required
- Low risk (won't break existing functionality)
- Doesn't require coordination with other people/services

Otherwise it's a **Larger lift**.

Examples:

| Easy | Larger |
|---|---|
| Replace default favicon | Build auth system from scratch |
| Add `.env.example` | Migrate from session to JWT |
| Add CI lint step | Set up multi-region deployment |
| Custom 404 page | Add billing integration |
| Replace `console.log` with logger | Refactor monolith into services |

### 5. Write `MVP_PLAN.md`

Write to `$CWD/MVP_PLAN.md`. Use this exact skeleton — replace the placeholders, keep the structure:

````markdown
# MVP Plan — <project-name>

> Generated: <YYYY-MM-DD>
> Source: `<absolute path>`
> Detected stack: <e.g. Next.js + tRPC + Postgres>
> Modules: <count> · LOC (approx): <count>

## TL;DR

**Status snapshot:** <one-sentence honest assessment — "demo-ready", "feature-complete but unpolished", "core paths work, infra missing", etc.>

**Top three blockers to launch:**
1. <thing>
2. <thing>
3. <thing>

---

## ✅ Easy wins (≤1 day each)

- [ ] **<area>** — <terse action>. _(why: <one-line rationale>)_
- [ ] **<area>** — <terse action>.
…

## 🏗️ Larger lifts (multi-day / cross-cutting)

- [ ] **<area>** — <terse action>. _(scope: <e.g. ~3 days, touches auth + db>)_
- [ ] **<area>** — <terse action>.
…

---

<details>
<summary><b>1. Architecture</b></summary>

### Build & dev loop
- <finding>

### CI / CD
- <finding>

### Env & secrets
- <finding>

### Containerisation & deploy
- <finding>

### Observability
- <finding>

### Auth
- <finding>

### Data layer
- <finding>

### API contract
- <finding>

### Tests
- <finding>

### Documentation
- <finding>

### Licensing & legal
- <finding>

</details>

<details>
<summary><b>2. Modules</b></summary>

<details>
<summary><code>&lt;module-name-1&gt;</code> — <one-line purpose></summary>

- <finding> _(file:line if applicable)_
- <finding>

</details>

<details>
<summary><code>&lt;module-name-2&gt;</code> — <purpose></summary>

- <finding>

</details>

<!-- one collapsible per module -->

</details>

<details>
<summary><b>3. Code-level callouts</b></summary>

High-signal `path:line` references worth fixing before launch (≤20 items, no exhaustive list):

- `src/foo/bar.ts:142` — empty catch swallows db errors
- `app/api/users/route.ts:88` — hardcoded admin email
- …

</details>

<details>
<summary><b>4. UI / UX / Branding</b></summary>

### Branding
- <finding>

### Visual polish
- <finding>

### States (loading, empty, error)
- <finding>

### Forms
- <finding>

### Accessibility
- <finding>

### Mobile / responsive
- <finding>

### Performance
- <finding>

### SEO
- <finding>

### Onboarding / first-run
- <finding>

</details>

<details>
<summary><b>5. Product polish & launch readiness</b></summary>

- <finding>
- <finding>

</details>

<details>
<summary><b>6. Notes & design recommendations</b></summary>

Anything that doesn't belong in the checklists — architectural suggestions, refactors worth considering post-MVP, decisions that need a human, dependencies to watch, technical debt log.

- <note>
- <note>

</details>

---

_Generated by `/mvp-analysis`. Re-run with `/mvp-analysis . --update` to refresh; checked-off items will be preserved._
````

### 6. Rules for the output

- **Be concrete.** "Add error tracking" is weak. "Add Sentry — `package.json` has no error-reporting dep; wire to `app/error.tsx` and server error filter" is good.
- **Be terse.** One bullet = one line where possible. Use `_(why: …)_` for short rationales, not paragraphs.
- **Cite files.** When a finding ties to specific code, end the bullet with `` `path/to/file:line` `` so the user can click through.
- **Don't pad.** If a section has no findings, write `_Nothing critical found._` and move on. Empty checklists invite noise; explicit "all good" reassures.
- **Don't duplicate.** If something is in the top "Easy wins" list, don't restate it verbatim in the per-module section — just reference it: "_(see Easy wins)_".
- **Don't invent.** If you don't have evidence for a finding, don't list it. Speculation belongs in section 6 (Notes), framed as a question.
- **Use checkboxes** (`- [ ]`) only in the two priority lists at the top. Section bodies use plain bullets — they're descriptive, not actionable.
- **Order priority lists by impact**, not by where you found them.

### 7. After writing

- Print a short summary to the chat: counts of easy wins and larger lifts, top 3 blockers, and the absolute path of `MVP_PLAN.md`.
- Do **not** offer to start implementing items unless the user asks. The skill produces a plan, nothing more.
- If `--update` was passed and the file already existed, also print: "preserved N already-checked items".

## Skipping

- Skip auto-generated dirs: `node_modules`, `vendor`, `dist`, `build`, `.next`, `.cache`, `target`, `__pycache__`, `*.egg-info`, `.venv`.
- Skip lockfiles for content scanning (only their existence matters).
- Don't analyse the contents of `MVP_PLAN.md` itself if it already exists — only its checkbox state when in `--update` mode.

## Failure modes

- **Repo too large to walk in reasonable time** — fall back to: top-level dirs as modules, README + entry points only, with a note in section 6 that deeper analysis is needed.
- **No discernible stack** — say so plainly in the TL;DR and bias the plan toward "set up the basics" rather than fabricating findings.
- **Mono-repo with many apps** — produce one `MVP_PLAN.md` per app under each app's folder, then a top-level `MVP_PLAN.md` that summarises and links to them.
