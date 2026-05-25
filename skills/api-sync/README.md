# API Sync Skill

Propagates changes from a modified library/package to all dependent projects in a workspace. After modifying a shared package (like `@vendidit/shared` or `@vendidit/auth`), this skill finds every project that imports from it, updates renamed exports, fixes broken references, and optionally commits the changes.

## Quick Start

```
/api-sync
```

That's it. Run it from the project you just modified. It will:
1. Detect what exports changed since your last commit
2. Find all sibling projects that depend on this package
3. Update their imports, package references, and docs
4. Show a summary and ask whether to commit

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--root <path>` | Parent of current project | Where to scan for dependent projects |
| `--external-root <path>` | (none) | Additional directory to scan for external dependents |
| `--clients <paths>` | (none) | Comma-separated explicit project paths to treat as clients. Always included. Use when the source isn't a package (e.g. an API server) but downstream SDKs still need syncing. |
| `--manifest <file>` | Auto | SDK-clients manifest. Default search: `.claude/contracts/sdk-clients.{json,yaml,yml}` in the project. Manifest entries are always included. |
| `--skip <names>` | (none) | Comma-separated project folders to exclude |
| `--dry-run` | false | Preview changes without modifying anything |
| `--since <ref>` | `HEAD~1` | Git ref to diff against (e.g. `HEAD~3`, `v1.0.0`) |
| `--no-commit` | false | Skip the commit prompt |
| `--include-docs` | true | Also update READMEs and documentation |

**Ecosystems:** npm (package.json + JS/TS imports) **and** Go (go.mod + Go imports). Both can appear in the same project/manifest.

## Single Package vs Monorepo

The skill auto-detects which mode to use based on the project structure.

**Single package** (e.g. running from `@vendidit/shared`):
- Analyzes exports changed in this one package
- Scans the parent directory for sibling projects that depend on it
- Updates those projects

**Monorepo** (e.g. running from `~/Sites/ven/new/` which contains `api/`, `client/`, `shared/`):
- Detects monorepo via `workspaces`, `pnpm-workspace.yaml`, `lerna.json`, etc.
- Groups changed files by sub-package automatically
- Finds cross-package references *within* the monorepo (e.g. `api` imports from `shared`)
- Does **not** scan parent directories unless `--external-root` is given
- Only scans the current project for *changes* — external dirs are scanned for *references* only

**Key rule:** Changes are detected in the current directory. Everything else is only checked for references to those changes.

**Monorepo + external dependents:**
```
/api-sync --external-root ~/Sites/ven
```
This analyzes changes in the current monorepo, finds cross-refs within it, AND scans `~/Sites/ven` for external projects (like `seller-portal`, `buyer-portal`) that also depend on the changed packages.

## How It Works

### Step 1: Analyze Changes
Diffs the current project against `--since` to extract (per sub-package in monorepos):
- **Renamed exports** — `oldFunctionName` → `newFunctionName`
- **Removed exports** — functions/types that no longer exist
- **Added exports** — new public API surface
- **Signature changes** — same name but different parameters/return type
- **Package changes** — name or version bumped

In monorepo mode, the output is `{ packages: [...] }` with one entry per changed sub-package. Only packages with actual export changes are included.

### Step 2: Verify Specs
Checks for API spec files (`API-SPEC.md`, `.claude/contracts/`) and ensures they reflect the changes.

### Step 3: Find Affected Projects
Three sources, used together:
1. **Auto-discovery** — scans the shared root for `package.json` *and* `go.mod`. A project is "affected" if it:
   - Has the package in `dependencies`, `devDependencies`, or `peerDependencies`
   - Has `tsconfig.json` path aliases pointing to the package
   - Has source files that `import`/`require` the package (TS/JS) or import the Go module path (in `.go` files)
2. **Explicit `--clients`** — comma-separated paths passed on the CLI; always included.
3. **Manifest** — `.claude/contracts/sdk-clients.json` in the project declaring its known downstream clients. Loaded automatically if present. Always included.

Use manifest/explicit modes when the source isn't a package itself (e.g. a REST API server) but you still need to keep N SDK clients in sync.

### Step 4: Update References
Ensures each affected project's `package.json` uses the correct dependency reference (prefers remote GitHub URL for CI/CD deployability).

### Step 5: Update Imports
For each affected project, searches source files for old export names and replaces them. Files with signature changes (same name, different shape) are flagged for manual review.

### Step 6: Summary
Prints a table showing each affected project, what was changed, and anything needing manual attention.

### Step 7: Commit
Prompts:
- `1` — Commit each affected project
- `2` — Commit and push each project
- `3` — Do nothing (changes are in working tree)

## Helper Scripts

The skill delegates scanning and file manipulation to Node.js scripts for efficiency:

```
~/.claude/skills/api-sync/scripts/
  utils.js              # Shared: git ops, project scanning, import searching
  analyze-changes.js    # Diff exports between commits → JSON
  find-affected.js      # Scan root for dependent projects → JSON
  update-refs.js        # Fix package.json dep references
  update-imports.js     # Rename imports in source files
```

All scripts accept `--help` and output JSON to stdout.

### Using Scripts Directly

```bash
# What changed?
node ~/.claude/skills/api-sync/scripts/analyze-changes.js \
  --project /path/to/shared --since HEAD~1

# Who depends on it?
node ~/.claude/skills/api-sync/scripts/find-affected.js \
  --root /path/to/workspace --package @vendidit/shared

# Preview import updates (dry run)
node ~/.claude/skills/api-sync/scripts/update-imports.js \
  --project /path/to/api --changes /tmp/changes.json \
  --package @vendidit/shared --dry-run true

# Fix package.json references
node ~/.claude/skills/api-sync/scripts/update-refs.js \
  --project /path/to/api --package-name @vendidit/shared \
  --remote-url git@github.com:Vendidit/auction-shared.git
```

## Examples

**Single package — after renaming an enum in `@vendidit/shared`:**
```
/api-sync --root ~/Sites/ven
```
→ Finds `api-server`, `new/api`, `new/client`, seller-portal, buyer-portal
→ Updates `import { OldEnum }` → `import { NewEnum }` in each
→ Commits with "chore: sync with @vendidit/shared changes"

**Monorepo — after modifying multiple packages in `~/Sites/ven/new/`:**
```
cd ~/Sites/ven/new
/api-sync
```
→ Detects monorepo (multiple sub-packages with package.json)
→ Finds `shared` had 3 export changes, `auth` had 1 signature change
→ Updates cross-refs: `api` imports 14 files from `shared`, `client` imports 8
→ Does NOT scan outside `~/Sites/ven/new/` unless told to

**Monorepo + external projects:**
```
cd ~/Sites/ven/new
/api-sync --external-root ~/Sites/ven
```
→ Same as above, PLUS scans `seller-portal`, `buyer-portal`, `api-server` for refs

**After modifying the Go auth server API:**
```
/api-sync --root ~/Sites/ven/new --skip client.solid
```
→ Finds `new/api` (depends on auth endpoints)
→ Flags handler files that call changed endpoints for manual review

**Project with a manifest (declared SDK clients):**
```
cd ~/Sites/blobs
/api-sync
```
→ Auto-loads `.claude/contracts/sdk-clients.json`
→ Walks the declared clients (go/sdk, go/pkg, web/sdk, web/sdk-solid, web/client, web/admin, …)
→ For each, detects which declared packages it actually imports, how many files reference them, and flags the rest for manual review.

**Ad-hoc explicit list (no manifest yet):**
```
/api-sync --clients go/sdk,web/sdk,web/sdk-solid,web/sdk-react
```
→ Always inspects those four dirs, even if they don't appear to import anything yet (useful right after scaffolding a new SDK).

**Dry run to preview:**
```
/api-sync --dry-run
```
→ Shows what would change, modifies nothing
