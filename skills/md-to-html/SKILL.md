---
name: md-to-html
description: Convert Markdown to standalone, nicely styled HTML. Use when the user asks to convert, render, export or preview a .md file (or every .md file in a folder) as HTML — "/md-to-html <file|folder>", "convert this markdown to html", "make an html version of the docs". Uses a standard token-based style (STYLE-SCHEMA.md) that a project can override with .claude/md-to-html/theme.json or style.css.
---

# /md-to-html — Markdown → styled HTML

Converts one Markdown file, or every `.md` in a folder, to a self-contained
HTML file (CSS inlined, no external assets) with a consistent, readable style:
headings with anchors, a contents sidebar for longer documents, scrolling
tables, code blocks, task lists, footnotes, light/dark mode and print styles.

## Usage

```
/md-to-html <file.md | folder> [options]
```

Run the bundled script (do not hand-write HTML):

```bash
python3 ~/.claude/skills/md-to-html/scripts/md2html.py <target> [options]
```

| Option | Effect |
|---|---|
| *(file)* | convert that file → `<name>.html` next to it |
| *(folder)* | convert every `*.md` in the folder (not sub-folders) |
| `-r`, `--recursive` | include sub-folders (skips node_modules, .git, dist, build, dot-folders) |
| `--out DIR` | write under DIR instead, keeping the folder layout |
| `--theme FILE` | token overrides (JSON) merged over the default style |
| `--css FILE` | a full replacement stylesheet |
| `--toc` / `--no-toc` | force / suppress the contents sidebar (default: shown when there are ≥ 4 h2/h3 headings) |
| `--dark` / `--light` | force a color scheme (default: follows the system) |
| `--title TEXT` | page title (default: the first `#` heading, else the file name) |
| `--engine auto\|pandoc\|python` | default `auto`: pandoc (GitHub-flavored Markdown) when installed, else Python-Markdown |
| `-q` | quiet |

In folder mode, links between converted files (`other.md#x`) are rewritten to
`other.html#x`.

## Steps

1. Resolve the user's path (relative to the current directory). If none was
   given, ask which file or folder.
2. Pass through any style the user or project asked for: `--theme` / `--css`
   from the prompt, otherwise the script finds the project's
   `.claude/md-to-html/theme.json` or `style.css` by itself.
3. Run the script; report each output path. Offer to open the file
   (`xdg-open` / `open`) if the user wants to see it.
4. On "needs pandoc or the Python 'markdown' package": suggest
   `pip install --user markdown` (or installing pandoc) and retry.

## Styling

The default style and its tokens are defined in **[STYLE-SCHEMA.md](STYLE-SCHEMA.md)**
(the standard every style follows) and implemented in
[styles/default.css](styles/default.css). To give a project its own look,
create `.claude/md-to-html/theme.json` in the project (token overrides — the
preferred way) or `.claude/md-to-html/style.css` (a full stylesheet that must
cover the elements listed in the schema). Precedence: `--css` › `--theme` ›
project `style.css` › project `theme.json` › default.

## Requirements

Python 3.9+, and either `pandoc` or the Python `markdown` package.
