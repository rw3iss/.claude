#!/usr/bin/env python3
# Screen a set of name variations for existing US trademarks and patents.
# This is a FIRST-PASS screening tool, not a legal clearance search.
# Proper trademark clearance covers phonetic variants, design marks, and
# Nice classes — get a real IP attorney before betting a brand on this.
#
# Usage:  tm-check.py <name> [<name> ...]
#         tm-check.py livedoc LiveDoc "Live Doc"
#
# Auth:   Set USPTO_API_KEY to use the official USPTO Open Data Portal API
#         (patent + trademark search). Without it, prints clickable
#         manual-search URLs as the fallback.
#         Sign up: https://developer.uspto.gov/  →  My Account → API Keys
#         Subscribe to: Patent Public Search + Trademark Search
#         Then: export USPTO_API_KEY=...   (add to ~/.zshrc or ~/.bashrc)

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 10.0
RESULTS_PER_SOURCE = 3
USER_AGENT = "tm-check/2.0"

USPTO_API_BASE = "https://api.uspto.gov/api/v1"
USPTO_PATENT_PATH = "/patent/applications/search"
USPTO_TM_PATH = "/trademark/cases/search"

USPTO_TM_MANUAL = "https://tmsearch.uspto.gov/search/search-results?searchText={q}"
GOOGLE_PATENTS_MANUAL = "https://patents.google.com/?q={q}"


def _c(code: str) -> str:
    return code if sys.stdout.isatty() else ""

GREEN = _c("\033[32m")
RED = _c("\033[31m")
YELLOW = _c("\033[33m")
DIM = _c("\033[2m")
BOLD = _c("\033[1m")
RESET = _c("\033[0m")

API_KEY = os.environ.get("USPTO_API_KEY", "").strip()


def _request_json(url: str, params: dict | None = None) -> dict:
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "X-API-KEY": API_KEY,
    }
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read()
    return json.loads(raw) if raw else {}


def search_patents(name: str) -> dict:
    if not API_KEY:
        return {"ok": False, "fallback": GOOGLE_PATENTS_MANUAL.format(q=urllib.parse.quote_plus(f'"{name}"'))}
    try:
        # USPTO uses Elasticsearch query_string syntax — wrap multi-word names
        # in double quotes for phrase matching, otherwise tokens are OR'd
        # (`Live Doc` → 11k matches instead of the actual ~10 for the phrase).
        q = f'"{name}"' if " " in name else name
        data = _request_json(USPTO_API_BASE + USPTO_PATENT_PATH, {
            "q": q,
            "limit": RESULTS_PER_SOURCE,
        })
        results = data.get("patentFileWrapperDataBag") or []
        total = data.get("count", len(results))
        rows = []
        for r in results[:RESULTS_PER_SOURCE]:
            meta = r.get("applicationMetaData") or {}
            pid = r.get("applicationNumberText") or "?"
            title = (meta.get("inventionTitle") or "").strip().rstrip(".")
            rows.append((pid, title))
        return {"ok": True, "total": total, "rows": rows}
    except urllib.error.HTTPError as e:
        # USPTO returns 404 with "No matching records" when zero hits — that's
        # a successful search, not an error.
        if e.code == 404:
            try:
                body = json.loads(e.read())
                if "No matching" in body.get("detailedMessage", ""):
                    return {"ok": True, "total": 0, "rows": []}
            except Exception:
                pass
        msg = f"HTTP {e.code}"
        return {"ok": False, "error": msg, "fallback": GOOGLE_PATENTS_MANUAL.format(q=urllib.parse.quote_plus(f'"{name}"'))}
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        return {"ok": False, "error": str(e), "fallback": GOOGLE_PATENTS_MANUAL.format(q=urllib.parse.quote_plus(f'"{name}"'))}


def search_trademarks(name: str) -> dict:
    # USPTO's Open Data Portal has no free-text trademark search API exposed
    # for public keys (only TSDR record-by-serial, which can't search by mark
    # text). Until that changes, this stays on the manual-URL fallback.
    return {"ok": False, "fallback": USPTO_TM_MANUAL.format(q=urllib.parse.quote_plus(name))}


def _wide(s: str, n: int) -> str:
    s = s or ""
    return s if len(s) <= n else s[: n - 1] + "…"


def render(name: str, tm: dict, pat: dict) -> None:
    print(f"\n{BOLD}{name}{RESET}")

    # Trademarks
    if tm.get("ok"):
        n = tm["total"]
        mark = f"{GREEN}✓ no USPTO matches{RESET}" if n == 0 else f"{RED}{n} USPTO match{'es' if n != 1 else ''}{RESET}"
        print(f"  TM   {mark}")
        for serial, m, st in tm["rows"]:
            print(f"       {DIM}#{serial:<10}{RESET} {_wide(m, 40):<40} {DIM}{_wide(st, 30)}{RESET}")
    else:
        print(f"  TM   {YELLOW}? no free-text trademark API — search manually:{RESET}")
        print(f"       {DIM}{tm['fallback']}{RESET}")

    # Patents
    if pat.get("ok"):
        n = pat["total"]
        if n == 0:
            print(f"  PAT  {GREEN}✓ no patent matches{RESET}")
        else:
            print(f"  PAT  {RED if n > 5 else YELLOW}~{n} patent match{'es' if n != 1 else ''}{RESET}")
        for pid, title in pat["rows"]:
            print(f"       {DIM}{pid:<16}{RESET} {_wide(title, 60)}")
    else:
        reason = pat.get("error") or "no API key"
        print(f"  PAT  {YELLOW}? {reason} — search manually:{RESET}")
        print(f"       {DIM}{pat['fallback']}{RESET}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Screen name variations for existing trademarks (USPTO) and patents (USPTO). NOT a legal clearance search.",
    )
    parser.add_argument("names", nargs="+", help="Name variations. Quote multi-word names: 'Live Doc'.")
    args = parser.parse_args()

    if not API_KEY:
        print(f"{YELLOW}note: USPTO_API_KEY not set — falling back to manual-search URLs.{RESET}", file=sys.stderr)
        print(f"{DIM}      get a free key at https://developer.uspto.gov/ then `export USPTO_API_KEY=...`{RESET}", file=sys.stderr)

    # Serial patent calls — USPTO rate-limits to a few requests/sec, and
    # firing 3+ at once trips 429. Trademark is just URL formatting, no I/O.
    for name in args.names:
        tm = search_trademarks(name)
        pat = search_patents(name)
        render(name, tm, pat)

    print(f"\n{DIM}Screening only — phonetic variants, design marks, and Nice classes are NOT covered. Confirm with USPTO TM Search + an IP attorney.{RESET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
