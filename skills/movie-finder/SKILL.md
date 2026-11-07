---
name: find-movies
description: Search Gmail for Instagram/Facebook movie links sent to yourself, scrape metadata, identify movie titles, and generate an HTML report. Use when the user wants to find, catalog, or identify movies from their saved social media links.
---

# Movie Link Finder

Find and identify movies from Instagram/Facebook links you've emailed to yourself.

## Usage

### Quick scan (last 6 months, default)
```bash
python ~/.claude/skills/movie-finder/scripts/find_movies.py
```

### Custom time range
```bash
python ~/.claude/skills/movie-finder/scripts/find_movies.py --days 30
```

### Links only (skip scraping)
```bash
python ~/.claude/skills/movie-finder/scripts/find_movies.py --days 90 --links-only
```

### Custom output path
```bash
python ~/.claude/skills/movie-finder/scripts/find_movies.py --output ~/Desktop/movies.html
```

## AI-Powered Analysis

After running the script, the JSON data at `~/movie_links_data.json` contains all scraped metadata for unknown links. To have Claude analyze the unknowns:

1. Read `~/movie_links_data.json`
2. For each "unfound" entry, examine the metadata (og:title, og:description, body_text_preview, hashtags)
3. Use web search to cross-reference descriptions with known movies
4. Update the found/unfound lists and regenerate the HTML report

## Setup (first time)

Requires Gmail API OAuth credentials:
1. Go to https://console.cloud.google.com
2. Create or select a project
3. Enable the Gmail API
4. Credentials → Create Credentials → OAuth 2.0 Client ID → Desktop app
5. Download JSON → save as `~/gmail_credentials.json`
6. First run will open browser for OAuth consent

## Output Files

- `~/movie_links.md` — raw list of all extracted links
- `~/movie_links.html` — HTML report with collapsible found/unfound sections
- `~/movie_links_data.json` — full scraped data for further analysis
