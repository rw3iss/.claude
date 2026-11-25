#!/usr/bin/env python3
"""Costline: run time + estimated weighted tokens of one Claude Code session (main transcript + its subagents).

  costline.py <transcript_path> [session_id]      -> prints e.g. "⏱ 1h12m  ≈3.4M"

Run time = first transcript entry -> now. Tokens: message usage, deduplicated by message id, summed over the
transcript and every subagent transcript beside it (<transcript>/subagents/*.jsonl). Weighted like API prices, in
input-token equivalents: input 1, cache write 2 (1-hour cache), cache read 0.1, output 5. An estimate of what counts
against the account, comparable across sessions; not an exact account formula.

Incremental: a cache in /tmp/claude/costline-<key>.json keeps each file's read offset and totals, so each status
line refresh reads only the new lines.
"""
import glob, json, os, sys, time
from datetime import datetime

W = {"input": 1.0, "cache_write": 2.0, "cache_read": 0.1, "output": 5.0}


def fmt_tokens(n):
    return f"{n/1e6:.1f}M" if n >= 1e6 else f"{n/1e3:.0f}k"


def fmt_time(s):
    s = int(s)
    h, m = divmod(s // 60, 60)
    return f"{h}h{m:02d}m" if h else f"{m}m{s % 60:02d}s" if m < 10 else f"{m}m"


def main():
    if len(sys.argv) < 2 or not os.path.exists(sys.argv[1]):
        return
    tp = sys.argv[1]
    key = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else os.path.basename(tp)[:-6]
    os.makedirs("/tmp/claude", exist_ok=True)
    cpath = f"/tmp/claude/costline-{key}.json"
    try:
        c = json.load(open(cpath))
    except Exception:
        c = {"files": {}, "seen": [], "tot": {k: 0 for k in W}, "start": None}
    seen = set(c["seen"])
    files = [tp] + sorted(glob.glob(tp[:-6] + "/**/*.jsonl", recursive=True))
    for f in files:
        off = c["files"].get(f, 0)
        try:
            size = os.path.getsize(f)
        except OSError:
            continue
        if size <= off:
            continue
        with open(f, "rb") as fh:
            fh.seek(off)
            data = fh.read()
        end = data.rfind(b"\n") + 1          # only whole lines; the rest next time
        for line in data[:end].splitlines():
            try:
                j = json.loads(line)
            except Exception:
                continue
            if c["start"] is None and f == tp and j.get("timestamp"):
                c["start"] = j["timestamp"]
            m = j.get("message") or {}
            u = m.get("usage")
            mid = m.get("id")
            if not u or not mid or mid in seen:
                continue
            seen.add(mid)
            c["tot"]["input"] += u.get("input_tokens", 0) or 0
            c["tot"]["cache_write"] += u.get("cache_creation_input_tokens", 0) or 0
            c["tot"]["cache_read"] += u.get("cache_read_input_tokens", 0) or 0
            c["tot"]["output"] += u.get("output_tokens", 0) or 0
        c["files"][f] = off + end
    c["seen"] = list(seen)[-20000:]
    tmp = cpath + ".tmp"
    json.dump(c, open(tmp, "w"))
    os.replace(tmp, cpath)
    weighted = sum(W[k] * v for k, v in c["tot"].items())
    run = ""
    if c["start"]:
        try:
            t0 = datetime.fromisoformat(c["start"].replace("Z", "+00:00")).timestamp()
            run = "⏱ " + fmt_time(time.time() - t0)
        except Exception:
            pass
    print(f"{run}  ≈{fmt_tokens(weighted)}".strip())


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
