---
name: design-research
description: Find and download high-quality reference images for a topic, theme, or subject into ./docs/designs/research/<id>/. Use for design references when building custom 3D models (incl. orthographic side/front/rear/top views for tracing and sizing) or for aesthetic/environment/material/effect mood boards. Invocation: /design-research <request> [count:N] [match:tight|best|loose|chaos] [mode:subject|aesthetic] [other requirements]
argument-hint: <topic/subject> [count:10] [match:best] [mode:auto] [requirements…]
context: fork
agent: general-purpose
disable-model-invocation: true
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/fetch-image.sh *) Bash(curl *) Bash(mkdir *) Bash(identify *) Bash(file *) WebSearch WebFetch Read Write
---

# Design research

Find the best reference images for this request and save them in an organized folder:

**Request:** $ARGUMENTS

## 1. Parse the request

Read these options from the request. Free text that is not an option is the topic plus extra requirements. Follow every extra requirement (era, color, style, sources to use or avoid, orientation, and so on).

| Option | Default | Meaning |
|---|---|---|
| `count:N` (or "20 images", "find 15") | **10** | Number of images to save. |
| `match:` | **best** | How literal the results are (see table below). Also accept plain words: "tight", "literal", "loose", "chaotic", "wild", "inspiration". |
| `mode:` | **auto** | `subject` = a specific object/entity (vehicle, creature, prop, building, character). `aesthetic` = look and feel (environment, mood, lighting, material, texture, effect, style). `auto` = decide from the request; mixed requests get both. |

### Match factor

| Value | Behavior |
|---|---|
| `tight` | Literal. Only the exact subject or style named. Same model/variant/era. No interpretations. |
| `best` (default) | The best matches for the request. Small variation is fine when it adds useful reference value. |
| `loose` | About 60% close matches, 40% adjacent ideas: related designs, other eras, similar shapes or moods from other domains. |
| `chaos` | About 30% close matches, 70% lateral ideas: unexpected sources, cross-domain analogues (nature, architecture, industrial, film), material or shape ideas that could inspire the design. Each one still needs a stated link to the request. |

## 2. Create the output folder

`<id>` = a short kebab-case slug of the topic + today's date, for example `porsche-911-classic-2026-11-06`. If the folder exists, add `-2`, `-3`, and so on.

```
./docs/designs/research/<id>/
  README.md          # index (see step 5)
  sources.json       # machine-readable manifest
  orthographic/      # subject mode: side/front/rear/top/3-4 views, blueprints
  subject/           # subject mode: other good photos/renders/details of the subject
  aesthetic/         # aesthetic mode: environment / mood / lighting / composition
  materials/         # aesthetic mode: surface, texture, material close-ups
  inspiration/       # loose/chaos picks that are outside the literal request
```

Make only the subfolders that you use. Use paths relative to the current working directory.

## 3. Search

Search several sources. Prefer the original full-resolution files to thumbnails. Use WebSearch, WebFetch, and direct `curl` calls to public APIs and pages.

**Good sources** (pick by topic):
- **Wikimedia Commons API**: large, good for real objects, and its licenses allow reuse.
  `curl -s -A "design-research/1.0" "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=<q>&srnamespace=6&srlimit=20&format=json"`, then
  `...&action=query&titles=<File:...>&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=2000&format=json` (use `thumburl` for a 2000px copy, `url` for the original).
- **Openverse API** (CC-licensed images from many sites): `https://api.openverse.org/v1/images/?q=<q>&page_size=20`
- **Blueprints / orthographic views**: the-blueprints.com, drawingdatabase.com, smcars.net, manufacturer press/media sites, patent drawings (patents.google.com), museum collections, model-kit instruction sheets.
- **Aesthetics / environments / materials**: ArtStation, Behance, Unsplash, Pexels, Flickr (large sizes), museum open-access collections (Met, Smithsonian, Rijksmuseum), Poly Haven and ambientCG (materials and HDRIs), film stills sites.
- General web search with words such as "high resolution", "wallpaper", "4k", "press photo", "blueprint", "side view", "orthographic".

**Subject mode needs reference views.** For a specific object or entity, first try to find:
1. **Side profile**, 2. **front**, 3. **rear**, 4. **top**. Then 5. **3/4 view**, plus blueprints and drawings with dimensions when they exist.
- True orthographic drawings and blueprints are best. Next best are flat, telephoto photos taken from straight on, with little perspective distortion.
- Also record the real dimensions (length, width, height, wheelbase, and so on) when you find them. Put them in README.md, because they are needed to scale models.
- The reference views count toward `count`. Use the rest for the best other images: details, color/material close-ups, context.

**Aesthetic mode**: environment, lighting, palette, mood, material, and effect references. Get variety in composition and lighting. Do not save near-duplicates.

## 4. Download and verify

Download each image with the helper. It checks that the file is a real image of at least 600 px on its short side (more for big subjects if possible). It deletes failed downloads:

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-image.sh "<image-url>" "./docs/designs/research/<id>/<subfolder>/<NN>-<short-slug>" [min-px]
```

- File names: `NN-short-description` (for example `01-side-profile`, `02-front`, `07-interior-dash`). The script adds the extension.
- Look at each candidate with the Read tool before you accept it. Reject watermarked previews, collages, low-quality or wrong subjects, heavy compression, and AI-generated images, unless the request asks for them.
- When a download fails, try another source. Continue until you have `count` good images, or until you have searched widely and found no more. If you cannot fill the count, say so and say why.
- If an image is blocked from download (hotlink protection, login), put it in README.md as a link-only entry. Do not count it.

## 5. Write the index

**README.md**:
- Request, match factor, mode, date.
- **Dimensions** (subject mode): real measurements with sources.
- **Reference views** table: view | file | type (blueprint / ortho photo / near-ortho) | notes (for example "slight perspective, telephoto").
- Table for each subfolder: preview `![](path)` | file | WxH | source page link | author/license (when known) | why it was picked (one line; for inspiration picks, state the link to the request).
- **Gaps**: views or items that you could not find, and suggestions for the next search.

**sources.json**: an array of `{file, category, view, width, height, image_url, source_page, author, license, notes}`.

## 6. Report

Reply in a short form: the folder path, the number of images in each category, which reference views you found or did not find, the dimensions found, and any gaps. Do not paste the full README.

## Rules

- Download only images that are publicly available. Do not bypass paywalls or logins.
- Record the source and license of each image. These are for private design reference. Mark any image that has an unknown or restrictive license.
- Do not use generated images (Midjourney, AI) unless the request asks for them. Use the `/design` skill for generated images.
