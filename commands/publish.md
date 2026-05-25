# Publish a new project release

Prepare, commit, build, and publish a new release of the current
active project. This command is intended to be the single entry
point for shipping a new version end-to-end.

## Workflow

Run the following steps in order. Stop and ask the user before
continuing if any step produces an ambiguous result or fails in a
way that shouldn't be silently retried.

### 1. Verify defaults and in-app data are current

- **Default user config.** Locate the project's default config
  definition (e.g. `internal/config/config.go`, `config.default.json`,
  `src/config/defaults.*`, `settings.default.yaml`, etc.). Read it
  and verify that every field referenced from the code has a
  sensible default and every default that's advertised in the README
  actually exists and matches. Flag mismatches to the user with a
  diff and ask whether to reconcile.
- **Default shortcuts.** Find the default keyboard-shortcut map
  (`internal/shortcuts/defaults.json`, `keybindings.json`,
  `src/config/shortcuts.ts`, etc.) and compare it against every
  shortcut referenced from the code (action names, description
  tables, overlay renderers). Every action consumed by the UI
  should have a default binding; every default binding should be
  consumed by an action. Report gaps before fixing them.
- **Customisability.** Confirm that each shortcut surfaced in the
  defaults file is reachable by the user's per-machine override
  mechanism (usually a JSON file under the config dir loaded at
  startup). If the defaults file contains a new action that the
  override loader doesn't know about, fix the loader or surface
  the gap.
- **Help / shortcut information in the app.** Scan the in-app
  help overlay / hint strings for references to shortcuts. Any
  action not present in the help surface should either be added
  there or explicitly skipped with a note. Any help entry
  referencing a shortcut that no longer exists should be removed.

### 2. Update the README

- Read the current README top-to-bottom.
- Bring it in sync with the code's current state:
  - Feature list reflects everything the app actually does now.
  - Installation and usage snippets still match the current CLI
    flags, environment variables, and file paths.
  - Screenshots / examples still match the current UI layout
    (flag any that look stale — do not attempt to regenerate
    binary assets).
  - Keyboard-shortcut tables mirror the defaults file from step 1.
- If the README is disorganised, a gentle restructure is allowed
  — merge duplicated sections, fix heading levels, normalise
  terminology — but **never drop information** the user might
  still care about. When in doubt, move content rather than
  delete it.
- Do not rewrite the project's voice or tone.

### 3. Update extended documentation

- If the project has long-form docs (`How_It_Works.md`,
  `ARCHITECTURE.md`, `docs/`, `docs/internals/*`, etc.), read each
  one and bring it current with the latest code. Elaborate where
  appropriate — extended docs are the place for more technical
  depth than the README carries.
- Modified features should have their existing sections updated
  in place rather than an "update log" appended at the bottom.
- New features introduced since the last release should get
  either a new section or a clearly-labelled paragraph inside the
  most relevant existing section.
- Preserve the document's existing structure and any narrative
  flow the author deliberately set up.

### 4. Run the project's in-app documentation generator (if any)

- Check `package.json` scripts, the `Makefile`, `justfile`,
  `noxfile`, `tasks/`, `scripts/`, etc. for a target named
  something like `docs`, `gen-docs`, `generate-docs`, `doc-build`,
  `help-gen`, or a Go `go:generate` directive whose output is
  documentation.
- If one exists, run it. Capture any output it places in the
  working tree so it's picked up by the commit step below.
- If no such generator exists, skip this step without commentary.

### 5. Commit the prepared changes

- Run `git status` and `git diff --stat` to review what the
  previous steps touched.
- Stage only the files this command modified; do NOT run
  `git add -A` / `git add .` (never sweep unrelated in-progress
  work into a release commit).
- Write a concise commit summary that lists the real changes
  being shipped:
  - Lead with a single short summary line.
  - Follow with a bullet list of the notable feature additions /
    bug fixes / documentation updates, each written from the
    user's perspective.
  - End with any author attribution the user's other commit
    commands normally include.
- Commit on the current branch. Do not branch, rebase, or switch
  branches as part of this command.

### 6. Build and release

- Detect the release build target and run it. Common shapes:
  - Go projects: `make build`, `make release`, or
    `go build -ldflags "-s -w" ./cmd/...`.
  - Node projects: `npm run build` or `npm run release`.
  - Rust: `cargo build --release`.
  - Python: `python -m build` or `hatch build`.
- If the project has a versioning convention (git tag pattern,
  `version.go`, `package.json` version, `Cargo.toml` version,
  `pyproject.toml` version, `VERSION` file), bump it according to
  semver based on the nature of the committed changes (patch for
  fixes, minor for additive features, major only on explicit
  request).
- Tag the commit using the project's tag convention (`v1.2.3` by
  default). Push the commit and the tag to the remote.
- If the project has a `.github/workflows/release.yml` or similar
  CI release flow, pushing the tag is sufficient. Otherwise,
  create a GitHub release via `gh release create` with the commit
  summary as the body and attach any built artifacts.

### 7. NPM publish (only if applicable)

- If the project is a personal, user-owned npm package (check
  `package.json` for `"name"`, `"private": false`, and an
  npm-compatible version field):
  - Confirm the user is logged in with `npm whoami`. If not,
    tell them to run `npm login` themselves and stop here until
    they do. Do not attempt to script the login flow.
  - Run `npm publish` with the appropriate tag (`--tag latest`
    by default, `--tag next` if the user is cutting a pre-
    release).
- If the project is not an npm-published package (no
  `package.json`, or `"private": true`, or not the user's own
  namespace), skip this step silently.

## Hard rules

- Never force-push, rewrite history, or delete tags.
- Never touch `node_modules/`, `vendor/`, `third_party/`, or any
  generated directory aside from files produced by the in-app
  docs generator in step 4.
- Never `git add .` or `git add -A` — stage files explicitly by
  path so in-progress work isn't swept into the release.
- Never publish to npm without a successful `npm whoami` check.
- Never invent features in the README that the code doesn't
  implement. When documenting something, verify it in the source
  first.
- If a build, test, or publish command fails, stop and report the
  failure. Do not attempt to work around it destructively.
- Respect `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` and any
  project-local instructions. If they contradict this command,
  follow the project instructions and note the conflict.

## Output expectations

- Updated README, extended docs, defaults, shortcuts, and any
  generator output committed on the current branch.
- A single tag pushed to the remote matching the project's
  versioning convention, with release artifacts attached if the
  project uses GitHub releases.
- For personal npm packages: the new version published to the
  npm registry under the user's own login.
- A final summary message to the user listing: the new version
  string, the commit hash, the tag, any CI run URL, and whether
  npm publish happened.
