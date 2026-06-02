# Generate design images via the designer skill

Evoke the **designer** skill to generate application-style design images
(Midjourney, through your own Discord bot) from a natural-language brief. Output
lands under `./designs/<request-name>/images/`.

## Steps

1. **Read the brief** — Treat everything after `/design` as the design brief: what
   UI to generate (login form, dashboard, product page, etc.) plus any
   constraints or flags. The brief is:

   $ARGUMENTS

2. **If no brief was given** — Print
   `usage: /design <brief>   e.g. /design a luxury watch PDP, cream + champagne gold, editorial serif`
   and stop.
3. **Invoke the skill** — Use the Skill tool with `skill: "designer"`, passing the
   brief through. Let the skill walk up from the current directory for a
   `DESIGN.md` and merge those project rules; honor any extra flags the user
   included (aspect ratio, "no gradients", etc.).
4. **Follow the skill exactly** — Do what `designer/SKILL.md` dictates (prepare
   prompt → trigger Midjourney → split the grid → save variants). Don't
   reimplement the workflow here.
