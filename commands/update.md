# Update a project's dependencies

Upgrade every dependency in the current active project to the latest
working version, fix any breakage the upgrade introduces, and leave
the changes committed on a dedicated branch ready for review.

## Workflow

Run the following steps in order. Stop and ask the user before
continuing if any step produces an ambiguous result or fails in a
way that shouldn't be silently retried.

### 1. Prepare the workspace

- Run `git status` to make sure the working tree is clean. If there
  are uncommitted changes, stop and ask the user to stash or commit
  them first — never sweep unrelated in-progress work into an
  update branch.
- Check whether an `updates` branch already exists:
  - If it does, `git checkout updates` and run `git pull --ff-only`
    (if the branch has an upstream) so the branch is current.
  - If it doesn't, create it from the current branch with
    `git checkout -b updates`.
- Record the starting commit SHA so the final summary can link
  back to the pre-update state.

### 2. Detect project type and tooling

Inspect the project root to identify every dependency manifest
present:

- **Go:** `go.mod` + `go.sum`
- **Node:** `package.json` + `package-lock.json` / `pnpm-lock.yaml`
  / `yarn.lock` / `bun.lockb`
- **Rust:** `Cargo.toml` + `Cargo.lock`
- **Python:** `pyproject.toml` + `poetry.lock` / `uv.lock`,
  or `requirements*.txt`, or `Pipfile.lock`
- **Ruby:** `Gemfile` + `Gemfile.lock`
- **PHP:** `composer.json` + `composer.lock`
- **.NET:** `*.csproj` / `*.fsproj` / `packages.config`
- **Java / Kotlin:** `pom.xml`, `build.gradle(.kts)`
- **Container / deploy configs:** `Dockerfile`, `docker-compose*.yml`,
  `.github/workflows/*.yml`, `fly.toml`, `render.yaml`,
  `.gitlab-ci.yml`, `Makefile`
- **Tooling pins:** `.tool-versions` (asdf), `.nvmrc`, `mise.toml`,
  `rust-toolchain.toml`, `python-version`

A project can mix several — treat each manifest independently and
upgrade them all.

### 3. Snapshot the baseline

Before touching anything:

- Record the current version of each top-level dependency
  (whatever the ecosystem's "installed version" query returns —
  `go list -m all`, `npm ls --depth=0`, `cargo tree --depth 1`,
  `pip freeze`, `bundle list`, etc.).
- Verify the baseline actually builds and (if fast enough) runs its
  test suite — otherwise upgrade breakage can't be distinguished
  from pre-existing breakage. If the baseline is broken, stop and
  report; do not proceed with upgrades on top of a broken tree.

### 4. Upgrade dependencies

Apply the appropriate upgrade command for each manifest found:

- **Go:**
  - `go get -u ./...` then `go mod tidy`.
  - For stricter ecosystems, consider `go get -u=patch ./...` first
    to capture safe patches before jumping to majors.
- **Node (npm):** `npm outdated` to list, then `npm update` for
  minors/patches. For majors, `npx npm-check-updates -u` followed
  by `npm install`.
- **Node (pnpm):** `pnpm update --latest` (or `pnpm update` for
  respect-ranges).
- **Node (yarn):** `yarn upgrade --latest` (or `yarn upgrade`).
- **Rust:** `cargo update` for the lockfile, `cargo upgrade` (from
  `cargo-edit`) if available for majors.
- **Python (poetry):** `poetry update`. For majors: manual edit of
  `pyproject.toml` constraints + `poetry lock --no-update` per pkg.
- **Python (uv):** `uv sync --upgrade`.
- **Python (pip):** recompile a `requirements.txt` with
  `pip-compile --upgrade` if `pip-tools` is present; otherwise
  inspect and bump manually.
- **Ruby:** `bundle update`.
- **PHP:** `composer update`.
- **.NET:** `dotnet list package --outdated`, then `dotnet add
  package <name>` for each outdated package.
- **Gradle / Maven:** `./gradlew dependencyUpdates` or `mvn
  versions:display-dependency-updates`, then apply the suggested
  updates by editing the manifest.

Also update any pinned tool versions (`.nvmrc`, `.tool-versions`,
`rust-toolchain.toml`, Docker base images) when the project's
target allows it — but be conservative: tool-version bumps are
separate changes with their own compatibility matrix.

### 5. Update CI / build / deploy configuration

After the dependency pass, scan the build/deploy config for
pinned versions that should follow along:

- **Dockerfiles:** base images (`FROM node:20-alpine` → check for
  newer LTS). Don't jump major OS versions without explicit intent.
- **GitHub Actions:** `uses:` lines for actions (`actions/checkout@v4`,
  `actions/setup-go@v5`, etc.) — bump to the current majors from
  their release pages.
- **Makefile / scripts:** any hard-coded version strings.

Be conservative here: CI config changes are easy to get wrong, so
only bump versions, don't refactor.

### 6. Build and test after upgrades

Run the project's normal build + test flow:

- Go: `go build ./...` then `go test ./...`
- Node: the `build` script from `package.json`, then `test`.
- Rust: `cargo build` then `cargo test`.
- Python: whatever's configured in `pyproject.toml` / `tox.ini` /
  `noxfile.py` / `Makefile`.
- Projects with a `Makefile`: `make` / `make test` / `make lint`.

If everything passes, move to step 8 (commit).

### 7. Resolve breaking changes (iterative)

If the build or tests fail after the upgrade, do an iterative
bisect to isolate the offending package:

1. Read the error output carefully. If the breakage is a clear
   API change (renamed symbol, removed export, new required
   argument), try to fix the call sites directly — this is the
   preferred outcome.
2. If the fix isn't obvious or would be invasive, **regress only
   the offending package**, not the whole upgrade. Use the
   ecosystem's "install specific version" command
   (`go get pkg@v1.2.3`, `npm install pkg@1.2.3`, `cargo update
   -p pkg --precise 1.2.3`, etc.) to pin it one minor or major
   behind the broken release.
3. Rebuild. If it passes, note the regression in the summary so
   the user knows one package is not at latest.
4. If the build still fails after a single-package regression,
   repeat the bisect — peel back another package's version, one
   at a time.
5. Only if no combination yields a clean build, fall back to
   reverting the entire manifest change set and report to the user
   which specific packages couldn't be updated safely.

Do not attempt more than ~3 rounds of fallback per package before
giving up and reporting. Infinite retry loops are worse than a
clear "this package is blocking the update" message.

### 8. Commit and push

Once the build and (fast) tests pass:

- Run `git status` / `git diff --stat` to review what changed.
- Stage only the files this command modified. This includes every
  manifest and lockfile touched by the upgrade, plus any source
  files edited to fix API changes in step 7, plus any CI config
  touched in step 5. Do NOT run `git add -A` / `git add .`.
- Write a commit summary with:
  - A single short summary line (e.g. `chore(deps): bulk upgrade to
    latest — N packages bumped, M held back`).
  - A bullet list grouping the upgrades by ecosystem. For each
    ecosystem list the notable version bumps (`foo: 1.2.3 →
    2.0.0`). Collapse patch-only bumps into a `+N other patches`
    line to keep the message tractable.
  - A **"Held back"** section listing any packages that failed
    the upgrade path and the reason (API break, test failure,
    transitive conflict). Include the version they're pinned at
    and the version that was attempted.
  - A **"Source-level fixes"** section listing any files edited
    to accommodate API changes, with a one-line note per fix.
  - Any author attribution the user's other commit commands
    normally include.
- Commit on the `updates` branch.
- Push the branch to the remote with `git push -u origin updates`
  (or plain `git push` if upstream is already set).

### 9. Report to the user

Print a final summary message containing:

- The starting commit SHA and the new commit SHA on `updates`.
- A count of packages successfully upgraded vs. held back.
- The path to the commit message so the user can review the bullet
  breakdown.
- A one-line reminder that `updates` is still a branch, not
  merged — they should review and open a PR / merge themselves.

## Hard rules

- Never force-push, rewrite history, or delete tags.
- Never work on a dirty tree — require `git status` clean before
  checkout.
- Never sweep unrelated files into the commit — stage explicitly.
- Never bump major versions of tooling (Node LTS, Go, Rust edition,
  Python minor version) without flagging the change to the user
  first. Dependency bumps are in scope; toolchain bumps are a
  separate conversation.
- Never delete or disable tests to "make the build pass".
- Never downgrade a package without recording the downgrade in the
  commit summary.
- Never touch `vendor/`, `node_modules/`, `target/`, `dist/`, or
  any directory that looks like a build artifact or third-party
  cache.
- Never run destructive git operations (`reset --hard`, force push,
  branch delete) as part of recovery. If an upgrade can't be made
  to work, check out a fresh copy of the manifest file from `HEAD`
  and try a more conservative version pin instead.
- Respect `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` and any project-
  local instructions. If they contradict this command, follow the
  project instructions and note the conflict in the summary.

## Output expectations

- An `updates` branch with:
  - One commit containing the manifest/lockfile updates, any
    source-level fixes needed to accommodate API changes, and any
    CI/deploy config bumps.
  - A commit message listing successful upgrades, held-back
    packages, and source fixes.
- The branch pushed to the remote (not merged to the default
  branch — that stays the user's decision).
- A final summary in chat with the starting SHA, the new SHA, the
  upgrade/holdback counts, and a reminder that the branch is
  awaiting review.
