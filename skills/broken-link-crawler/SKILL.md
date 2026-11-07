---
name: broken-link-crawler
description: Run the broken-link-crawler tool to find broken asset links (CSS, JS, images, fonts, CDN URLs) in a local project directory or a live website URL. Use when the user asks to check for broken links, missing assets, or dead links in a project.
---

# Broken Link Crawler

Find broken links in a project's HTML files or a live website.

## How to Run

Detect which binary to use, in priority order:

1. **Local project binary** — `./node_modules/.bin/broken-link-crawler` (if the project has it installed)
2. **Global binary** — `broken-link-crawler` (if installed globally via `npm install -g`)
3. **Direct node call** — `node ~/Sites/ven/new/tools/packages/broken-link-crawler/dist/cli.js` (fallback to known path)

Detect with:
```bash
if [ -f ./node_modules/.bin/broken-link-crawler ]; then
  CMD="./node_modules/.bin/broken-link-crawler"
elif command -v broken-link-crawler &>/dev/null; then
  CMD="broken-link-crawler"
elif [ -f "$HOME/Sites/ven/new/tools/packages/broken-link-crawler/dist/cli.js" ]; then
  CMD="node $HOME/Sites/ven/new/tools/packages/broken-link-crawler/dist/cli.js"
else
  echo "broken-link-crawler not found. Install with: npm install -g broken-link-crawler"
  exit 1
fi
```

## Usage Patterns

### Check current project directory (console output)
```bash
$CMD
```

### Check current project, generate Markdown report
```bash
$CMD --markdown
# Then read broken-links.md and display its contents inline
```

### Check current project, generate HTML report
```bash
$CMD --html
# Report written to broken-links.html in current directory
```

### Check a live site
```bash
$CMD https://upstream.vendidit.com
```

### Check a live site with increased depth
```bash
$CMD https://upstream.vendidit.com --depth 10
```

### Check non-HTML files too
```bash
$CMD --ext "**/*.{html,htm}"
```

## Output Handling

- **Console (default):** Display the output directly in the conversation
- **Markdown (`--markdown`):** After writing the file, read `broken-links.md` and display it inline using the Read tool
- **HTML (`--html`):** After writing the file, tell the user the path and offer to summarize the key findings

## Results Format

For console output, look for lines starting with `✗` — those are broken links. The summary line at the bottom gives totals.

For Markdown output, display the file content directly. It is already formatted.

## Interpreting Results

Broken link status codes:
- `404 Not Found` — file or URL does not exist
- `ETIMEDOUT` — server did not respond in time (may be transient)
- `ENOTFOUND` — DNS failure — domain does not exist
- `ECONNREFUSED` — server actively refused connection
- `500`, `502`, `503` — server errors (may be transient)

For CDN/external links that timeout, suggest retrying with `--timeout 15000`.

## If Tool Not Found

Tell the user to install it:
```bash
# Global install
npm install -g ~/Sites/ven/new/tools/packages/broken-link-crawler

# Or from the monorepo package directory
cd ~/Sites/ven/new/tools/packages/broken-link-crawler && npm run build
```
