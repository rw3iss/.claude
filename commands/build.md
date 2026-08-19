# Build or extend a Preact app via the build skill

Evoke the **build** skill to build a new page/feature into the current
project, scaffold a new app when none exists, or bootstrap rule files — always
following the project's `DESIGN.md` / `BUILD.md` / `COMPONENT_INDEX.md` and reusing
existing components before creating new ones. Also handles skill **maintenance**:
`/build update` updates your local install of these skills + commands.

## Steps

1. **Read the request** — Treat everything after `/build` as the request (what to
   build or extend, plus any guidance). The request is:

   $ARGUMENTS

2. **Maintenance — `/build update`.** If the request, trimmed and lower-cased, is
   `update`, `upgrade`, `refresh`, or `--update`, this is a **skill-maintenance**
   request, **not** a build. Do only the following, then stop:
   - Run this with the Bash tool (updates the local install from the latest `main`):
     ```bash
     curl -fsSL https://raw.githubusercontent.com/rw3iss/design-build-skills/main/install.sh | bash -s -- --update
     ```
   - This re-fetches the latest **build** + **design** skills into
     `~/.claude/skills/` and **refreshes the `/design` and `/build` commands** in
     `~/.claude/commands/` (the installer syncs the commands on every `--update`, so
     the skills and commands stay in lock-step).
   - Report the installer's summary (the installed skill versions it prints). If it
     fails (e.g. no network), surface the error — the existing install is untouched.
   - **No restart needed:** Claude Code hot-reloads skills and command files from
     disk, so the next `/build`, `/design`, or build invocation picks up the
     updated version automatically. (`/reload-plugins` is only relevant if these were
     installed as a plugin; the default install is a plain skill, so it isn't needed.)
   - **Stop** — do not invoke the build skill for an update request.

3. **If no request was given** — Print
   `usage: /build <what to build>   e.g. /build add a settings page  |  /build from images 2 and 4  |  /build update`
   and stop.

4. **Invoke the skill** — Use the Skill tool with `skill: "build"`, passing
   the request through. Let the skill resolve the target (extend the existing app
   found by walking up from the CWD, or scaffold a new one), read the rule files,
   reuse/extend before creating, and write/follow `PLAN.md`. Reference images are
   optional and used only if the request supplies them.
5. **Docs-only shortcut** — If the request is just to set up rule files
   ("generate a BUILD.md", "bootstrap docs", "add a DESIGN.md"), use the skill's
   docs-only bootstrap (`bootstrap_docs.ts`) — no code generated.
6. **Follow the skill exactly** — Do what `build/SKILL.md` dictates. Don't
   reimplement the workflow here.
