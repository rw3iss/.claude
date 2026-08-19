# Check domain availability across a fixed TLD set

Check whether one or more base names are registered across `.com`, `.net`, `.org`, `.dev`, `.app`, `.io` via RDAP. Uses the script at `~/.claude/scripts/domain-check.py`.

## Steps

1. **Read the argument(s)** — Treat everything after `/domain-check` as a space-separated list of base names. Strip any leading/trailing whitespace per name. Reject any name that already contains a dot (the script checks a fixed TLD set; passing `foo.com` is a usage error).
2. **If no argument was given** — Print a one-line usage hint (`usage: /domain-check <name> [<name> ...]`) and stop. Do not prompt.
3. **Run the script** — Execute `~/.claude/scripts/domain-check.py <names...>` via Bash, passing all names as separate arguments. The script handles parallel RDAP queries, colorized output, and expiry dates.
4. **Show the output verbatim** — Don't reformat, summarize, or annotate. The script's table is already the answer.

## Rules

- Don't install anything; the script is pure-stdlib Python 3.
- Don't change the TLD set from the command — that's a property of the script. If the user wants a different set, edit the script's `TLDS` dict.
- Don't add WHOIS fallbacks, DNS sniffing, or other backends. RDAP is the source of truth for this command.
