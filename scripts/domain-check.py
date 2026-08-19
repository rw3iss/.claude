#!/usr/bin/env python3
# Check domain availability via RDAP (IETF successor to WHOIS — JSON over
# HTTPS, no API keys, 404 = available, 200 = registered).
#
# Usage:  domain-check.py <name> [<name> ...]
#         domain-check.py mycoolproject              # checks default TLD set
#         domain-check.py foo bar baz                # multiple names, default TLDs
#         domain-check.py do.cc                      # specific TLD, only that one
#         domain-check.py foo bar.io do.cc           # mix is fine

import argparse
import concurrent.futures
import json
import sys
import urllib.error
import urllib.request

# Default TLD set (checked when input has no dot). Per IANA bootstrap.
TLDS = {
    "com": "https://rdap.verisign.com/com/v1",
    "net": "https://rdap.verisign.com/net/v1",
    "org": "https://rdap.publicinterestregistry.org/rdap",
    "dev": "https://pubapi.registry.google/rdap",
    "app": "https://pubapi.registry.google/rdap",
    "io":  "https://rdap.identitydigital.services/rdap",
}

IANA_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json"
TIMEOUT = 6.0
USER_AGENT = "domain-check/2.0 (+rdap)"

# Memoized IANA bootstrap table — populated lazily on first ad-hoc TLD lookup.
_IANA_BOOTSTRAP: dict[str, str] | None = None


def _c(code: str) -> str:
    return code if sys.stdout.isatty() else ""

GREEN = _c("\033[32m")
RED = _c("\033[31m")
YELLOW = _c("\033[33m")
DIM = _c("\033[2m")
BOLD = _c("\033[1m")
RESET = _c("\033[0m")


def _load_iana_bootstrap() -> dict[str, str]:
    """Fetch IANA's RDAP bootstrap once, return {tld: base_url}."""
    global _IANA_BOOTSTRAP
    if _IANA_BOOTSTRAP is not None:
        return _IANA_BOOTSTRAP
    req = urllib.request.Request(IANA_BOOTSTRAP_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read())
    mapping: dict[str, str] = {}
    for entry in data.get("services", []):
        # Each entry: [[tld, tld, ...], [url, url, ...]]
        tlds, urls = entry[0], entry[1]
        if not urls:
            continue
        base = urls[0].rstrip("/")
        for t in tlds:
            mapping[t.lower()] = base
    _IANA_BOOTSTRAP = mapping
    return mapping


def resolve_tld_rdap(tld: str) -> str | None:
    """Find the RDAP base URL for any TLD. Returns None if no RDAP service."""
    tld = tld.lower()
    if tld in TLDS:
        return TLDS[tld]
    try:
        return _load_iana_bootstrap().get(tld)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None


def check_one(name: str, tld: str, base_url: str | None = None) -> tuple[str, str, str]:
    """Return (tld, status, detail) where status is AVAILABLE / TAKEN / UNKNOWN."""
    if base_url is None:
        base_url = resolve_tld_rdap(tld)
    if base_url is None:
        return tld, "UNKNOWN", "no RDAP service for this TLD"
    fqdn = f"{name}.{tld}"
    url = f"{base_url}/domain/{fqdn}"
    req = urllib.request.Request(url, headers={
        "Accept": "application/rdap+json",
        "User-Agent": USER_AGENT,
    })
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read()
            data = json.loads(body) if body else {}
            # Some registries return 200 with an errorCode of 404 in the body.
            if data.get("errorCode") == 404:
                return tld, "AVAILABLE", ""
            expiry = ""
            for ev in data.get("events", []) or []:
                if ev.get("eventAction") in ("expiration", "registration expiration"):
                    expiry = f"expires {ev.get('eventDate', '?')[:10]}"
                    break
            return tld, "TAKEN", expiry
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return tld, "AVAILABLE", ""
        if e.code == 429:
            return tld, "UNKNOWN", "rate-limited"
        return tld, "UNKNOWN", f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return tld, "UNKNOWN", f"net error: {e.reason}"
    except Exception as e:
        return tld, "UNKNOWN", f"{type(e).__name__}: {e}"


def _format_line(tld: str, status: str, detail: str) -> str:
    if status == "AVAILABLE":
        mark = f"{GREEN}✓ available{RESET}"
    elif status == "TAKEN":
        mark = f"{RED}✗ taken{RESET}"
    else:
        mark = f"{YELLOW}? {detail or 'unknown'}{RESET}"
    line = f"  .{tld:<4} {mark}"
    if status == "TAKEN" and detail:
        line += f" {DIM}({detail}){RESET}"
    return line


def check_specific(name: str, tld: str) -> None:
    """User specified `name.tld` — check only that single TLD."""
    print(f"\n{BOLD}{name}.{tld}{RESET}")
    tld_lc = tld.lower()
    result = check_one(name, tld_lc)
    print(_format_line(tld_lc, result[1], result[2]))


def check_default(name: str) -> None:
    """User passed bare name — check the default TLD set in parallel."""
    print(f"\n{BOLD}{name}{RESET}")
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(TLDS)) as pool:
        results = list(pool.map(lambda t: check_one(name, t, TLDS[t]), TLDS))
    by_tld = {r[0]: r for r in results}
    for tld in TLDS:
        _, status, detail = by_tld[tld]
        print(_format_line(tld, status, detail))


def check_name(arg: str) -> None:
    arg = arg.strip().lower()
    if "." in arg:
        name, _, tld = arg.rpartition(".")
        if not name or not tld:
            sys.exit(f"error: malformed input {arg!r}")
        check_specific(name, tld)
    else:
        check_default(arg)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check domain availability via RDAP. Bare name → default TLD set; name.tld → only that TLD.",
        epilog="Default TLDs: " + ", ".join(f".{t}" for t in TLDS),
    )
    parser.add_argument("names", nargs="+", help="Base names (default TLD set) or fully-qualified domains (single check).")
    args = parser.parse_args()
    for name in args.names:
        check_name(name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
