---
name: api-sync
description: Sync library/SDK/API changes across dependent projects. Scans for affected projects, updates references, method names, types, and documentation. Handles both "package consumers" (auto-discovered by imports/dependencies) and "declared clients" (projects that consume a server API but aren't a package — listed in a manifest). Works across npm and Go ecosystems. Use after modifying a shared library, SDK, API server, or package that other projects depend on.
---

# API / Library / SDK Sync

Propagate changes from a modified library, package, or API server to all projects that depend on it. Handles renamed exports, updated signatures, changed package references, and documentation — across **npm** and **Go** ecosystems.

Works with three discovery modes, usable together:

1. **Auto-discovery by package name** — scan a root dir for projects that import or depend on the changed package (npm name or Go module path).
2. **Monorepo mode** — detect which sub-packages changed and find cross-package dependents inside the monorepo.
3. **Manifest/explicit-clients mode** — read a project-level list of downstream clients. This is what you want when the source **isn't a package** (e.g. a REST API server or a Go server package) but several SDKs still need to be kept in sync. The manifest lives at `.claude/contracts/sdk-clients.json` (or `.yaml` if js-yaml is available).

## When to Use

- After modifying a shared library (e.g. `@vendidit/shared`, `@vendidit/auth`, `@blobs/sdk`)
- After modifying multiple packages in a monorepo
- After modifying an API server or shared service that isn't itself a package but has downstream SDK clients
- To verify all cross-project references are up to date

## Invocation

```
/api-sync [options]
```

**Examples:**
```
/api-sync                                    # Sync current project's changes
/api-sync --root ~/Sites/ven                 # Scan from specific root
/api-sync --skip buyer-portal,tracker        # Skip specific projects
/api-sync --dry-run                          # Show what would change without modifying
/api-sync --since HEAD~3                     # Look at last 3 commits
/api-sync --external-root ~/Sites/ven        # Also scan external dir for dependents
/api-sync --clients go/sdk,web/sdk,web/sdk-solid   # Explicit list of downstream clients
/api-sync --manifest .claude/contracts/sdk-clients.json  # Use a declared client list
```

## Monorepo vs Single-Package Behavior

**Single package** (e.g. running from `@vendidit/shared`):
- Analyzes exports changed in this one package
- Scans parent directory for sibling projects that depend on it
- Updates those projects

**Monorepo** (e.g. running from `~/Sites/ven/new/` which contains `api/`, `client/`, `shared/`):
- Auto-detects monorepo via `workspaces`, `pnpm-workspace.yaml`, etc.
- Identifies which sub-packages had changes since `--since`
- For each changed package, finds dependents both inside AND outside the monorepo
- Cross-package references within the monorepo are included
- Does NOT scan parent directories unless `--external-root` is given

**Key rule:** The skill only searches the current project for *changes*. External directories (parent, `--external-root`) are only scanned for *references* to the changed packages.

## Options

Parse these from the user's message or prompt extras:

| Option | Default | Description |
|--------|---------|-------------|
| `--root <path>` | Parent of current project | "Shared root" folder to scan for dependent projects |
| `--external-root <path>` | (none) | Additional directory to scan for external dependents |
| `--clients <paths>` | (none) | Comma-separated explicit project paths to treat as clients. Always included, no discovery needed. Use when the source isn't a package (e.g. an API server) but downstream SDKs still need syncing. |
| `--manifest <file>` | Auto | Path to an SDK-clients manifest. When omitted, looks for `.claude/contracts/sdk-clients.{json,yaml,yml}` in the current project. Manifest clients are always included. |
| `--skip <projects>` | (none) | Comma-separated project folder names to exclude |
| `--dry-run` | false | Report changes without modifying files |
| `--since <ref>` | `HEAD~1` | Git ref to diff against for detecting changes |
| `--no-commit` | false | Skip the commit prompt at the end |
| `--include-docs` | true | Update READMEs and documentation |

## Manifest Schema

A project can declare its downstream clients in `.claude/contracts/sdk-clients.json` so this skill doesn't have to auto-discover them. JSON is preferred (zero deps); YAML works only if the project has `js-yaml` installed.

```json
{
  "source": "my-platform",
  "description": "Human-readable summary of what this platform publishes.",
  "clients": [
    {
      "path": "go/sdk",
      "name": "Go SDK",
      "kind": "go",
      "packages": ["github.com/org/project/sdk"],
      "notes": "Own go.mod. Rebuild with `cd go/sdk && go build ./...`."
    },
    {
      "path": "web/sdk",
      "name": "TypeScript SDK",
      "kind": "npm",
      "packages": ["@org/sdk"],
      "notes": "Rebuild with `npm run build` so file: consumers see new dist/."
    }
  ]
}
```

Fields:
- `path` (required): project dir, relative to the manifest's repo root or absolute.
- `name` (optional): human label for reports.
- `kind` (optional): `npm` | `go` | `other` — hint for the skill; auto-detected when possible.
- `packages` (optional): list of package names / Go module paths the client imports from. Used to detect actual usage and locate import sites inside this client.
- `notes` (optional): free-form, surfaced in the summary.

Manifest entries are **always emitted** in the affected list, even if no import matches are found — this forces the agent to at least read them and confirm nothing is stale.

## Process

### Step 1: Analyze Changes

Run the helper script to extract what changed:

```bash
node ~/.claude/skills/api-sync/scripts/analyze-changes.js \
  --project "$(pwd)" \
  --since "${since:-HEAD~1}"
```

The script auto-detects monorepos (via `workspaces`, `pnpm-workspace.yaml`, etc.) and groups changed files by sub-package. Output is `{ packages: [...] }` where each entry has:
- Package name and directory
- Changed/renamed exports (functions, types, enums, constants)
- Changed file paths (moved/renamed modules)
- Package name or version changes
- New/removed exports
- Changed method signatures

For a single-package project, `packages` has one entry. For a monorepo, it has one entry per changed sub-package.

Review the output. If nothing meaningful changed (only internal refactors with no export changes), report that and stop.

### Step 2: Check Specs and Contracts

Look for spec/contract files in the current project:
- `API-SPEC.md`, `API.md`, `SPEC.md`
- `.claude/contracts/api-spec.yaml`
- `.claude/contracts/types.ts`
- `docs/api/` directory

If found, verify the changes are reflected. If not, update them.

### Step 3: Find Affected Projects

Save the Step 1 output to a temp file, then scan for dependents:

```bash
# Single package:
node ~/.claude/skills/api-sync/scripts/find-affected.js \
  --root "${root}" \
  --package "$(node -p "require('./package.json').name")" \
  --self "$(pwd)" \
  --skip "${skip:-}"

# Monorepo (pass all changed packages at once):
node ~/.claude/skills/api-sync/scripts/find-affected.js \
  --root "$(pwd)" \
  --changes-file /tmp/api-sync-changes.json \
  --self "$(pwd)" \
  --external-root "${externalRoot:-}" \
  --skip "${skip:-}"

# Manifest / explicit clients (source isn't a package):
node ~/.claude/skills/api-sync/scripts/find-affected.js \
  --root "$(pwd)" \
  --self "$(pwd)" \
  --manifest "$(pwd)/.claude/contracts/sdk-clients.json" \
  --skip "${skip:-}"

# Or: ad-hoc explicit client list (no manifest needed):
node ~/.claude/skills/api-sync/scripts/find-affected.js \
  --clients go/sdk,go/pkg,web/sdk,web/sdk-solid,web/sdk-react \
  --self "$(pwd)"
```

In monorepo mode, `--root` is the monorepo itself (scans sub-packages for cross-refs). `--external-root` optionally adds a parent directory to find external dependents. `--self` is exact-match (in-repo sub-packages below the source dir are valid clients and are **not** excluded by prefix). The script deduplicates and excludes only `--self` directories matched exactly.

Output is a JSON array of affected projects with:
- Project path, name, branch
- Which changed packages it depends on (may be multiple in monorepo)
- How it references each (npm, git, file:, path alias)
- Files that import from each package

### Step 4: Update Package References

For each affected project, ensure the dependency reference is correct:
- Prefer remote GitHub URL for production deployability
- Use the current package version/tag if applicable
- If the package isn't in a remote repo, use `file:` and flag it in the summary

Run:
```bash
node ~/.claude/skills/api-sync/scripts/update-refs.js \
  --affected affected-projects.json \
  --package-name "$(node -p "require('./package.json').name")" \
  --remote-url "$(git remote get-url origin 2>/dev/null)"
```

### Step 5: Update Code References

For each affected project, search for old export names and update them:

```bash
node ~/.claude/skills/api-sync/scripts/update-imports.js \
  --affected affected-projects.json \
  --changes changes.json \
  --dry-run "${dryRun:-false}"
```

This handles:
- Renamed exports: `import { oldName }` → `import { newName }`
- Changed paths: `from '@pkg/old/path'` → `from '@pkg/new/path'`
- Signature changes: flags files that need manual review

For complex logic changes that can't be auto-migrated, the script outputs a `manual-review` section listing files and what changed.

### Step 6: Report Summary

Print a formatted summary:

```
┌─────────────────────────────────────────────────┐
│  API Sync Summary                               │
├─────────────────────────────────────────────────┤
│  Source: @vendidit/shared (3 exports changed)   │
│  Affected projects: 4                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ✓ seller-portal (develop)                      │
│    - Updated 3 import references                │
│    - Updated package.json version               │
│                                                 │
│  ✓ buyer-portal (develop)                       │
│    - Updated 2 import references                │
│    - README updated                             │
│                                                 │
│  ⚠ api-server (staging)                         │
│    - 1 file needs manual review                 │
│    - src/auth/middleware.ts:45 — signature change│
│                                                 │
│  ○ tracker (skipped by user)                    │
│                                                 │
├─────────────────────────────────────────────────┤
│  Manual review needed: 1 file(s)                │
└─────────────────────────────────────────────────┘
```

### Step 7: Commit Prompt

Ask the user:
```
What would you like to do with the affected projects?

  1) Commit changes to each project
  2) Commit and push each project
  3) Do nothing (changes are staged but not committed)
```

If they choose 1 or 2, commit each affected project with a message like:
```
chore: sync with @vendidit/shared changes

Updated imports and references to match latest shared package.
```

## Helper Scripts

The skill uses Node.js scripts in `~/.claude/skills/api-sync/scripts/` for the heavy lifting (scanning, parsing, diffing). This minimizes token usage — the agent calls the scripts and processes their JSON output.

### Script API

All scripts accept `--help` for usage info and output JSON to stdout. Errors go to stderr.

```
scripts/
  analyze-changes.js    # Diff exports between commits
  find-affected.js      # Scan for dependent projects
  update-refs.js        # Update package.json references
  update-imports.js     # Update import statements in code
  utils.js              # Shared utilities (git, parsing, formatting)
```

## Important Notes

- Always verify the current project builds before syncing to others
- Don't modify files in `node_modules/`
- Don't modify generated files (`src/openapi/`, `dist/`, etc.)
- Respect `.gitignore` in each project
- If a project has uncommitted changes, warn before modifying it
- The `--dry-run` flag should be used first when uncertain about changes
- **Go projects are supported**: `findProjects` detects both `package.json` and `go.mod`; `findImports` scans both TS/JS and `.go` files for any package name containing `/` or `.` (i.e. Go module paths).
- **Manifest entries are always emitted**, even with zero matches — the agent should still report them so the user can confirm nothing was missed (e.g. a newly-added client with no imports yet).
