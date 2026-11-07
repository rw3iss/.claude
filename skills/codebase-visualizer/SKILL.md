---
name: codebase-visualizer
description: Generate a PNG class-relationship diagram showing classes, interfaces, types, enums, and their inheritance/dependency relationships. Use when exploring architecture, understanding class hierarchies, or documenting code structure.
---

# Codebase Visualizer — Class Diagram

Generate a PNG class-relationship diagram from source code. Supports TypeScript/JavaScript (via ts-morph AST) and Python (via regex-based parsing). Language is auto-detected from file extensions.

## Usage

First ensure dependencies are installed:

```bash
cd ~/.claude/skills/codebase-visualizer/scripts && npm install
```

Then run the visualizer:

```bash
node ~/.claude/skills/codebase-visualizer/scripts/visualize.js [directory] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `directory` | Source directory to scan (default: `.`) |
| `--lang <language>` | Force language (`typescript`, `python`). Auto-detected if omitted. |
| `--scope <path>` | Scope to a subdirectory (tries `./path`, `./src/path`, `./packages/path`) |
| `--methods` | Show method signatures in class/interface boxes |
| `--properties` | Show property types in class/interface boxes |
| `--output <file>` | Output PNG file path (default: `class-diagram.png`) |
| `--exclude <pattern>` | Glob pattern to exclude (repeatable) |
| `--open` | Open the diagram in the default viewer after generating |

## Examples

```bash
# Basic scan of a source directory
node ~/.claude/skills/codebase-visualizer/scripts/visualize.js ~/project/src

# Scoped to models with full detail
node ~/.claude/skills/codebase-visualizer/scripts/visualize.js ~/project/src --scope models --methods --properties

# Python project with properties
node ~/.claude/skills/codebase-visualizer/scripts/visualize.js ~/python-project/src --properties

# Custom output path with exclusions
node ~/.claude/skills/codebase-visualizer/scripts/visualize.js . --output ~/diagrams/api.png --exclude "**/*.test.*" --exclude "**/*.spec.*"
```

## What the diagram shows

- **Classes** (blue): With extends/implements relationships, optional methods and properties
- **Interfaces** (green): With method signatures and property types
- **Type aliases** (purple): With type definition text
- **Enums** (orange): With member values
- **Edges**: Solid arrows (extends), dashed arrows (implements), dotted gray (references)
- **External symbols**: Shown at reduced opacity when referenced but defined outside the scanned directory
- **Legend**: Color and line-style key at the bottom of the diagram
