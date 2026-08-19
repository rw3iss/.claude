# Screen name variations for existing trademarks and patents

Run an initial trademark and patent screening across one or more name variations using `~/.claude/scripts/tm-check.py`. NOT a legal clearance — flag this to the user if they treat the output as definitive.

## Steps

1. **Read the argument(s)** — Treat everything after `/tm-check` as a list of name variations. Multi-word variations may arrive already-grouped (the shell strips quotes), so just pass each item through to the script as a separate argument. Do not re-tokenize.
2. **If no argument was given** — Print `usage: /tm-check <name> [<name> ...]` and stop.
3. **Run the script** — Execute `~/.claude/scripts/tm-check.py "$arg1" "$arg2" ...` via Bash, quoting each argument so multi-word names stay intact. The script handles parallel queries (USPTO TM Search + Google Patents per variation) and renders a per-variation table.
4. **Show the output verbatim** — Don't reformat the table.
5. **Caveat reminder** — If the user reads the output as "no matches = safe to use," remind them in one sentence that this is a *screening tool only*: it doesn't cover phonetic variants, design marks, Nice classes, common-law marks, or international registrations.

## Rules

- Don't add new sources from this command — that's a script concern. If the user wants WIPO, EPO, or another registry, edit the script.
- USPTO TM Search's unofficial JSON endpoint is flaky; the script falls back to printing a manual-search URL. Don't try to "fix" that fallback by scraping — the manual link is the correct behavior when the API is down.
- Never claim a name is "available" or "safe" — only that "no matches were returned by these specific sources." Legal clearance is an attorney's job.
