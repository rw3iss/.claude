# Build or extend a Preact app via the design-build skill

Evoke the **design-build** skill to build a new page/feature into the current
project, scaffold a new app when none exists, or bootstrap rule files — always
following the project's `DESIGN.md` / `BUILD.md` / `COMPONENT_INDEX.md` and
reusing existing components before creating new ones.

## Steps

1. **Read the request** — Treat everything after `/build` as the request (what to
   build or extend, plus any guidance). The request is:

   $ARGUMENTS

2. **If no request was given** — Print
   `usage: /build <what to build>   e.g. /build add a settings page  |  /build from images 2 and 4  |  /build a BUILD.md`
   and stop.
3. **Invoke the skill** — Use the Skill tool with `skill: "design-build"`, passing
   the request through. Let the skill resolve the target (extend the existing app
   found by walking up from the CWD, or scaffold a new one), read the rule files,
   reuse/extend before creating, and write/follow `PLAN.md`. Reference images are
   optional and used only if the request supplies them.
4. **Docs-only shortcut** — If the request is just to set up rule files
   ("generate a BUILD.md", "bootstrap docs", "add a DESIGN.md"), use the skill's
   docs-only bootstrap (`bootstrap_docs.ts`) — no code generated.
5. **Follow the skill exactly** — Do what `design-build/SKILL.md` dictates. Don't
   reimplement the workflow here.
