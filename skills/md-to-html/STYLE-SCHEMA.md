# md-to-html style schema (v1)

The standard look of every Markdown file converted by `/md-to-html`. A style is
**tokens + coverage rules**: the default stylesheet (`styles/default.css`)
consumes only CSS custom properties, so a project restyles the output by
overriding tokens — no selectors needed — or replaces the stylesheet entirely
if it must.

## 1. Tokens

All tokens are CSS custom properties on `:root`, prefixed `--md-`. Dark-mode
values use the same name with `dark-` after the prefix (`--md-dark-color-bg`)
and apply under `prefers-color-scheme: dark`, or always with `--dark`
(`html[data-theme="dark"]`); `--light` forces light.

| Token | Default (light) | Default (dark) | Used for |
|---|---|---|---|
| `font-body` | system UI sans stack | – | body text |
| `font-heading` | = `font-body` | – | h1–h6 |
| `font-mono` | ui-monospace stack | – | code, kbd |
| `font-size` | `16px` | – | root size (rem base) |
| `line-height` | `1.65` | – | body text |
| `heading-weight` | `700` | – | h1–h6 |
| `h1-size` … `h4-size` | `2.1rem` `1.5rem` `1.2rem` `1.05rem` | – | heading sizes |
| `max-width` | `920px` | – | reading column |
| `space` | `1rem` | – | base spacing unit (blocks = 1×, sections = 2×) |
| `radius` | `8px` | – | code blocks, tables, quotes, images |
| `toc-width` | `260px` | – | contents sidebar |
| `color-bg` | `#ffffff` | `#0e1116` | page |
| `color-text` | `#1f2328` | `#d6dde6` | body text |
| `color-muted` | `#59636e` | `#8b96a5` | quotes, footnotes, TOC, footer |
| `color-heading` | `#0f1419` | `#f0f3f6` | headings, strong, table head text |
| `color-accent` | `#2f6feb` | `#6ea8ff` | links, h1 rule, TOC hover |
| `color-border` | `#d8dee4` | `#2b323c` | rules, table lines, code borders |
| `color-surface` | `#f6f8fa` | `#161b22` | quotes, kbd, narrow-screen TOC |
| `color-code-bg` | `#f3f4f6` | `#1b222c` | inline + block code |
| `color-code-text` | `#c2255c` | `#ff8fb3` | inline code |
| `color-quote-border` | `#c9d1d9` | `#3a4350` | blockquote left bar |
| `color-table-head` | `#f3f5f7` | `#1a2029` | `th` background |
| `color-table-stripe` | `#fafbfc` | `#12171e` | even rows |
| `color-mark` | `#fff3bf` | `#5c4b00` | `<mark>` |

## 2. Coverage rules (what every style must handle)

A replacement stylesheet (`style.css`) must style all of these, because the
converter emits them:

- **Page shell:** `.md-page` (flex row: TOC + body), `main.md-body` (the
  reading column), `nav.md-toc` (`.md-toc__title`, `li.md-toc--h2|h3`; sidebar
  on wide screens, a block above the body below ~1100px), `footer.md-footer`.
- **Headings:** `h1`–`h6`, each with an `id` and a trailing `a.md-anchor`
  ("#", shown on hover). `h1` is the document title.
- **Text:** `p`, `a`, `strong`, `em`, `del`, `mark`, `sup`/`sub`, `hr`, `img`.
- **Lists:** `ul`, `ol`, nested lists, task lists (`li > input[type=checkbox]`),
  `dl`/`dt`/`dd`.
- **Quotes:** `blockquote` (also used for callouts).
- **Code:** inline `code`, `pre > code`, `kbd`. No syntax highlighting by
  default (no colors to keep in sync).
- **Tables:** `div.md-table-wrap > table` (the wrapper scrolls horizontally and
  carries the border/radius), `th`, `td`, striped rows.
- **Footnotes:** `section.footnotes` / `.footnotes`.
- **Print:** hide the TOC, full width, avoid breaking code/tables.

Spacing rhythm: block elements `margin-bottom: var(--md-space)`; headings get
`2×` space above, `0.75×` below; `h1` and `h2` carry a bottom rule.

## 3. Overriding per project

Place one of these at the project root (the converter searches upward from
the source file to the git root):

```
.claude/md-to-html/theme.json   ← token overrides, merged over the default (preferred)
.claude/md-to-html/style.css    ← full replacement stylesheet (must meet §2)
```

`theme.json`:

```json
{
  "tokens": {
    "color-accent": "#e63946",
    "font-body": "Inter, system-ui, sans-serif",
    "font-heading": "\"Oswald\", Inter, sans-serif",
    "max-width": "1000px"
  },
  "dark": { "color-accent": "#ff6b6b" },
  "css": "h1 { text-transform: uppercase; }"
}
```

- `tokens` (alias `light`): token names without the `--md-` prefix (a full
  `--md-…` name also works).
- `dark`: dark-mode values (written to `--md-dark-…`).
- `css`: optional raw CSS appended last, for anything tokens can't express.

Precedence: `--css FILE` › `--theme FILE` › project `style.css` › project
`theme.json` › `styles/default.css`. Output files inline the final CSS, so
each `.html` is self-contained (no external assets).
