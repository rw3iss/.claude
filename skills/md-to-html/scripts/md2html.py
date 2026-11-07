#!/usr/bin/env python3
"""
md2html — convert Markdown files to standalone, styled HTML.

    md2html.py <file.md | folder> [--recursive] [--out DIR] [--css FILE] [--theme FILE]
               [--no-toc] [--toc] [--dark | --light] [--title TEXT] [--quiet]

* A FILE converts that file; a FOLDER converts every *.md in it (add --recursive
  for sub-folders; node_modules / .git / dist / build are skipped).
* Output: <name>.html next to each source (or under --out, keeping the folder
  layout). Links between converted .md files are rewritten to .html.
* Engine: pandoc (GitHub-flavored Markdown) when installed, else Python-Markdown.
* Style (first match wins), all inlined so each HTML file is self-contained:
    1. --css FILE      a full stylesheet (replaces the default)
    2. --theme FILE    a JSON token file merged over the default (see STYLE-SCHEMA.md)
    3. the nearest project config, searched upward from the source:
         .claude/md-to-html/style.css   (full replacement)
         .claude/md-to-html/theme.json  (token overrides)
    4. styles/default.css (the standard style)
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CSS = SKILL_DIR / "styles" / "default.css"
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", ".venv", "venv", "__pycache__"}
TOC_MIN_HEADINGS = 4

# ─── Markdown → HTML fragment ───────────────────────────────────────────


def _pandoc(text: str) -> str | None:
    exe = shutil.which("pandoc")
    if not exe:
        return None
    base = [exe, "-f", "gfm+footnotes+definition_lists", "-t", "html5", "--wrap=none"]
    for extra in (["--syntax-highlighting=none"], ["--no-highlight"], []):
        r = subprocess.run(base + extra, input=text, capture_output=True, text=True)
        if r.returncode == 0:
            return r.stdout
    return None


def _python_markdown(text: str) -> str:
    try:
        import markdown  # type: ignore
    except ImportError:
        sys.exit("md2html: needs pandoc or the Python 'markdown' package (pip install markdown).")
    return markdown.markdown(
        text,
        extensions=["extra", "toc", "sane_lists", "admonition"],
        extension_configs={"toc": {"permalink": False}},
        output_format="html5",
    )


def convert_markdown(text: str, engine: str) -> tuple[str, str]:
    if engine in ("auto", "pandoc"):
        out = _pandoc(text)
        if out is not None:
            return out, "pandoc"
        if engine == "pandoc":
            sys.exit("md2html: pandoc not found.")
    return _python_markdown(text), "python-markdown"


# ─── Post-processing ────────────────────────────────────────────────────

_slug_re = re.compile(r"[^\w\- ]+", re.UNICODE)


def slugify(text: str) -> str:
    s = _slug_re.sub("", html.unescape(re.sub(r"<[^>]+>", "", text))).strip().lower()
    return re.sub(r"\s+", "-", s) or "section"


def add_heading_ids(fragment: str) -> tuple[str, list[tuple[int, str, str]]]:
    """Ensure every h1–h4 has an id + an anchor link; return (html, headings)."""
    used: set[str] = set()
    headings: list[tuple[int, str, str]] = []

    def repl(m: re.Match) -> str:
        level, attrs, inner = int(m.group(1)), m.group(2) or "", m.group(3)
        idm = re.search(r'\bid="([^"]+)"', attrs)
        hid = idm.group(1) if idm else slugify(inner)
        base, n = hid, 1
        while hid in used:
            n += 1
            hid = f"{base}-{n}"
        used.add(hid)
        if idm:
            attrs = attrs.replace(idm.group(0), f'id="{hid}"')
        else:
            attrs = f' id="{hid}"{attrs}'
        text = re.sub(r"<[^>]+>", "", inner)
        headings.append((level, hid, html.unescape(text).strip()))
        anchor = f'<a class="md-anchor" href="#{hid}" aria-label="Link to this section">#</a>'
        return f"<h{level}{attrs}>{inner}{anchor}</h{level}>"

    out = re.sub(r"<h([1-4])(\s[^>]*)?>(.*?)</h\1>", repl, fragment, flags=re.S)
    return out, headings


def wrap_tables(fragment: str) -> str:
    return re.sub(r"(<table\b.*?</table>)", r'<div class="md-table-wrap">\1</div>', fragment, flags=re.S)


def rewrite_md_links(fragment: str, converted: set[Path], src: Path) -> str:
    """href="other.md[#x]" → other.html when that file is part of this run."""
    def repl(m: re.Match) -> str:
        href = m.group(1)
        if re.match(r"^[a-z]+:", href) or href.startswith("#"):
            return m.group(0)
        path, _, frag = href.partition("#")
        if not path.lower().endswith(".md"):
            return m.group(0)
        target = (src.parent / path).resolve()
        if target not in converted:
            return m.group(0)
        new = path[:-3] + ".html" + (f"#{frag}" if frag else "")
        return f'href="{new}"'
    return re.sub(r'href="([^"]+)"', repl, fragment)


def build_toc(headings: list[tuple[int, str, str]]) -> str:
    items = [(lvl, hid, txt) for (lvl, hid, txt) in headings if lvl in (2, 3)]
    if not items:
        return ""
    lis = "".join(
        f'<li class="md-toc--h{lvl}"><a href="#{hid}">{html.escape(txt)}</a></li>' for lvl, hid, txt in items
    )
    return f'<nav class="md-toc" aria-label="Contents"><p class="md-toc__title">Contents</p><ul>{lis}</ul></nav>'


# ─── Style resolution ───────────────────────────────────────────────────


def find_project_config(start: Path) -> tuple[Path | None, Path | None]:
    for d in [start, *start.parents]:
        cfg = d / ".claude" / "md-to-html"
        css, theme = cfg / "style.css", cfg / "theme.json"
        if css.is_file() or theme.is_file():
            return (css if css.is_file() else None), (theme if theme.is_file() else None)
        if (d / ".git").exists():  # stop at the repo root
            break
    return None, None


def theme_css(theme_file: Path) -> str:
    """theme.json → a :root block overriding default tokens.

    {"tokens": {"color-accent": "#e63946", "font-body": "Inter, sans-serif"},
     "dark":   {"color-accent": "#ff6b6b"},
     "css":    "extra raw CSS appended after"}
    Keys may be given with or without the leading "--md-".
    """
    data = json.loads(theme_file.read_text(encoding="utf-8"))

    def decls(d: dict, prefix: str) -> str:
        out = []
        for k, v in (d or {}).items():
            name = k if k.startswith("--") else f"--md-{prefix}{k}"
            out.append(f"  {name}: {v};")
        return "\n".join(out)

    parts = []
    light = decls(data.get("tokens") or data.get("light") or {}, "")
    dark = decls(data.get("dark") or {}, "dark-")
    if light or dark:
        parts.append(":root {\n" + "\n".join(x for x in (light, dark) if x) + "\n}")
    if data.get("css"):
        parts.append(str(data["css"]))
    return "\n".join(parts)


def resolve_css(args: argparse.Namespace, src: Path) -> tuple[str, str]:
    if args.css:
        return Path(args.css).read_text(encoding="utf-8"), f"--css {args.css}"
    base = DEFAULT_CSS.read_text(encoding="utf-8")
    if args.theme:
        return base + "\n/* theme */\n" + theme_css(Path(args.theme)), f"--theme {args.theme}"
    proj_css, proj_theme = find_project_config(src.parent)
    if proj_css:
        return proj_css.read_text(encoding="utf-8"), str(proj_css)
    if proj_theme:
        return base + "\n/* project theme */\n" + theme_css(proj_theme), str(proj_theme)
    return base, "default"


# ─── Page ───────────────────────────────────────────────────────────────


def page(title: str, body: str, toc: str, css: str, theme_attr: str, engine: str, src_name: str) -> str:
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    return f"""<!DOCTYPE html>
<html lang="en"{theme_attr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="md-to-html ({engine})">
<title>{html.escape(title)}</title>
<style>
{css}
</style>
</head>
<body>
<div class="md-page">
{toc}
<main class="md-body">
{body}
<footer class="md-footer">Generated from {html.escape(src_name)} · {stamp}</footer>
</main>
</div>
</body>
</html>
"""


def convert_file(src: Path, out: Path, args: argparse.Namespace, converted: set[Path]) -> None:
    text = src.read_text(encoding="utf-8")
    fragment, engine = convert_markdown(text, args.engine)
    fragment, headings = add_heading_ids(fragment)
    fragment = wrap_tables(fragment)
    fragment = rewrite_md_links(fragment, converted, src)
    title = args.title or next((t for lvl, _, t in headings if lvl == 1), src.stem)
    want_toc = args.toc or (not args.no_toc and sum(1 for h in headings if h[0] in (2, 3)) >= TOC_MIN_HEADINGS)
    toc = build_toc(headings) if want_toc else ""
    css, style_src = resolve_css(args, src)
    theme_attr = ' data-theme="dark"' if args.dark else (' data-theme="light"' if args.light else "")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page(title, fragment, toc, css, theme_attr, engine, src.name), encoding="utf-8")
    if not args.quiet:
        print(f"{src} → {out}  [{engine}, style: {style_src}]")


def collect(target: Path, recursive: bool) -> list[Path]:
    if target.is_file():
        return [target]
    if not target.is_dir():
        sys.exit(f"md2html: not found: {target}")
    files: list[Path] = []
    for root, dirs, names in os.walk(target):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        files += [Path(root) / n for n in names if n.lower().endswith((".md", ".markdown"))]
        if not recursive:
            break
    return sorted(files)


def main() -> None:
    p = argparse.ArgumentParser(description="Convert Markdown to styled standalone HTML.")
    p.add_argument("target", help="a .md file or a folder")
    p.add_argument("--recursive", "-r", action="store_true", help="include sub-folders")
    p.add_argument("--out", help="output folder (default: next to each source)")
    p.add_argument("--css", help="full stylesheet replacing the default")
    p.add_argument("--theme", help="JSON token overrides merged over the default")
    p.add_argument("--engine", choices=["auto", "pandoc", "python"], default="auto")
    p.add_argument("--toc", action="store_true", help="always add the contents sidebar")
    p.add_argument("--no-toc", action="store_true", help="never add the contents sidebar")
    p.add_argument("--dark", action="store_true", help="force the dark theme")
    p.add_argument("--light", action="store_true", help="force the light theme")
    p.add_argument("--title", help="page title (default: first H1, else the file name)")
    p.add_argument("--quiet", "-q", action="store_true")
    args = p.parse_args()

    target = Path(args.target).expanduser().resolve()
    files = collect(target, args.recursive)
    if not files:
        sys.exit(f"md2html: no .md files in {target}")
    converted = {f.resolve() for f in files}
    root = target if target.is_dir() else target.parent
    for f in files:
        rel = f.relative_to(root).with_suffix(".html")
        out = (Path(args.out).expanduser().resolve() / rel) if args.out else f.with_suffix(".html")
        convert_file(f, out, args, converted)
    if not args.quiet and len(files) > 1:
        print(f"Converted {len(files)} files.")


if __name__ == "__main__":
    main()
