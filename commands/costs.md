---
description: Show or hide the costs status (run time + estimated weighted tokens) in the Claude status line
argument-hint: "[on | off | all | none | status]"
---
Toggle the "costline" part of the status line (`~/.claude/scripts/costline.py`, shown by
`~/.claude/scripts/statusline-complete-single.sh`): `⏱ <run time>  ≈<weighted tokens>` for this session (main transcript
plus its subagents). Weighted = input 1, cache write 2, cache read 0.1, output 5 (input-token equivalents): an estimate
of what counts against the account.

Argument: `$ARGUMENTS` (default `on`).

- `on` / `off`: this session only. Find this session's id: the newest `*.jsonl` in
  `~/.claude/projects/<cwd with / and . replaced by ->/` that was modified in the last minute (this conversation).
  `on`: `touch ~/.claude/costline.d/<id>` and remove `~/.claude/costline.d/<id>.off`. `off`: remove `<id>`, touch `<id>.off`.
- `all`: `touch ~/.claude/costline.on` (every session, unless a session turned it off).
- `none`: remove `~/.claude/costline.on`.
- `status`: say which flags exist and print the current line: `python3 ~/.claude/scripts/costline.py <transcript> <id>`.

Agents started with the environment variable `CLAUDE_COSTLINE=1` always show it (`0` always hides it).
Do it with one Bash call, then reply in one line with the result. The status line refreshes on the next message.
