# Visualize the codebase

Generate a PNG class-relationship diagram of the current project using the `codebase-visualizer` skill.

## Arguments

- `$DIRECTORY` — optional source directory to scan. Defaults to `.` (project root).
- `$OPTIONS` — optional flags forwarded to the visualizer verbatim (e.g. `--lang python`, `--scope src/components`, `--output diagram.png`).

## Steps

1. **Invoke the skill** — Run the `codebase-visualizer` skill, passing `$DIRECTORY` and `$OPTIONS` through unchanged. The skill handles language detection, AST parsing, and diagram rendering.
2. **Report the output** — Tell the user the full path of the generated PNG and a one-line summary of what was included (language, file count, class count).

## Rules

- This is a thin wrapper. Do not re-implement the visualizer logic or call the underlying tools (`ts-morph`, `graphviz`, etc.) directly.
- If the skill fails, surface its exact error message and the remediation it suggests (e.g. missing `npm install` step). Do not improvise workarounds.
- Do not modify any source files. This command is read-only on the codebase.
