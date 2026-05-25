# Dead code removal

Perform a thorough dead-code audit of the current active project and
remove code that is safe to remove automatically, while surfacing a
second category of "likely-but-not-certain" candidates for the user
to approve.

## Workflow

1. **Identify the project's language(s) and tooling.**
   - Detect the primary language(s) from project files (`go.mod`,
     `package.json`, `Cargo.toml`, `pyproject.toml`, `*.csproj`,
     etc.).
   - If the project provides a linter/analyzer that reports unused
     code (e.g. `go vet` / `staticcheck` / `unused`, `eslint
     --rule 'no-unused-*'`, `ruff`, `pyright`, `tsc --noUnusedLocals
     --noUnusedParameters`, `cargo +nightly udeps`, `clippy`), run
     it read-only to gather a baseline of suspected dead symbols.
     Never run linter auto-fix modes — every removal must be a
     deliberate edit.
   - If no such tool exists, fall back to repository-wide grep-
     based searches for symbol references.

2. **Build a candidate list.** For every symbol you want to consider
   removing (function, method, type, constant, variable, file,
   import, exported API, dependency entry, config block, etc.):
   - Grep the entire repository for references by name, including
     string literals (tests, docs, build scripts, CI config,
     templates, SQL, shell scripts, generated code directives).
   - Verify the symbol isn't part of a public API surface that
     downstream consumers (other packages, plugins, clients,
     serialization formats, wire protocols) depend on.
   - Look for reflection, code generation, build tags, dynamic
     dispatch, HTTP/RPC routing tables, test fixtures, `init()`
     side-effects, and language-specific "referenced but hidden"
     patterns.

3. **Split candidates into two buckets:**
   - **Bucket A — Absolutely dead.** Zero references anywhere, no
     public/exported visibility, no build-tag gating, no
     reflection/codegen risk, no backwards-compatibility contract.
     Safe to delete outright.
   - **Bucket B — Likely dead but uncertain.** Unreferenced today
     but kept around for one of: exported/public API surface, a
     dormant feature flag, a compatibility shim, a test helper
     that looks unused, conditional build tags, reflection /
     codegen entry points, or any other defensible reason. Each
     entry needs a clearly-written justification for keeping it.

4. **Write an audit summary** at
   `docs/dead-code-audit-YYYY-MM-DD.md` (create the `docs/`
   directory if needed — use today's date from the environment
   context, not a guess). The document must contain:
   - A header with the date, the absolute working directory, and
     the command/tool used to gather candidates.
   - **Bucket A — Removed automatically.** A bulleted list with
     one line per removed symbol: `` `package.Symbol` — relative
     file path:line — one-sentence description of what it did``.
   - **Bucket B — Kept for review.** A bulleted list with one
     entry per candidate, each containing:
     - Qualified symbol name and file:line.
     - What it does.
     - **Why it was kept** — the specific reason removing it
       would be risky (exported API, feature flag, codegen,
       reflection, backwards-compat shim, test-only helper,
       etc.).
   - **Verification steps taken.** What lints/searches were run,
     what tests were executed, any manual greps performed.

5. **Remove Bucket A automatically.**
   - Edit each file to delete the symbol and any orphaned imports
     it leaves behind.
   - After each edit, re-run the project's build (`go build ./...`,
     `npm run build`, `cargo check`, `tsc --noEmit`, etc.) to
     confirm nothing else broke. If the build fails, revert the
     last removal, move the symbol to Bucket B with a note that
     it turned out to be referenced, and continue.
   - Run the project's test suite if one exists and is fast
     enough to complete without excessive blast radius.
   - Do not commit the changes — leave them staged in the working
     tree for the user to review.

6. **Present the summary to the user and ask for approval on
   Bucket B.**
   - Show the path to the audit document.
   - Print a short count summary: "Removed N items automatically,
     M items awaiting review."
   - Ask a single clear yes/no question: "Should I also remove the
     M items listed in Bucket B? (y / N / 'show me the list')".
   - If the user says yes, remove the Bucket B items the same way
     as Bucket A (edit, build, revert-on-failure) and update the
     audit document to move entries from Bucket B into a new
     **Bucket B — Removed after approval** section with any
     entries that failed the build noted.
   - If the user says no or asks for the list, print the Bucket B
     entries inline and re-prompt.

## Hard rules

- Never delete code that is part of a public/exported API without
  explicit user confirmation, even if no references are found in
  the current repository.
- Never delete generated files, vendored dependencies, or anything
  inside a directory that looks like third-party code (`vendor/`,
  `node_modules/`, `third_party/`, etc.).
- Never touch documentation (`*.md`), license files, or config
  files unless they contain directly-removed references.
- Never run destructive git operations. Removals happen as plain
  file edits in the working tree.
- If the build or tests break after a removal, revert that single
  removal and record the failure in the audit.
- Do not rewrite, simplify, rename, or refactor code in this pass
  — the only permitted changes are deletions of symbols identified
  as dead.
- Respect `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` and any project-
  local instructions. If they contradict this command, follow the
  project instructions and note the conflict in the audit.

## Output expectations

- A saved audit document at `docs/dead-code-audit-YYYY-MM-DD.md`.
- Bucket A removals already applied to the working tree, with the
  project's build passing.
- A single interactive prompt to the user asking whether to
  proceed with Bucket B, after which either another round of
  removals happens or the audit is left as-is for manual review.
