#!/usr/bin/env python3
"""
Movie Link Finder — Scans Gmail for Instagram/Facebook links sent to self,
scrapes metadata, and tries to identify movie titles.

Usage:
    python find_movies.py [--days 180] [--output ~/movie_links.html]
    python find_movies.py --days 30 --output ~/recent_movies.html

Requires:
    - ~/gmail_credentials.json (OAuth 2.0 Desktop client from Google Cloud Console)
    - Gmail API enabled in your Google Cloud project
    - pip install google-api-python-client google-auth-oauthlib requests beautifulsoup4
"""

import argparse
import base64
import json
import os
import pickle
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
CREDENTIALS_FILE = os.path.expanduser('~/gmail_credentials.json')
TOKEN_FILE = os.path.expanduser('~/.gmail_token.pickle')

# Patterns to match instagram/facebook URLs
LINK_PATTERNS = [
    re.compile(r'https?://(?:www\.)?instagram\.com/(?:reel|p|tv)/[A-Za-z0-9_-]+/?(?:\?[^\s<"]*)?', re.IGNORECASE),
    re.compile(r'https?://(?:www\.)?facebook\.com/(?:reel|watch|[^/]+/videos)/[^\s<"]*', re.IGNORECASE),
    re.compile(r'https?://fb\.watch/[A-Za-z0-9_-]+/?', re.IGNORECASE),
    re.compile(r'https?://(?:www\.)?instagram\.com/[A-Za-z0-9_.]+/(?:reel|p)/[A-Za-z0-9_-]+/?(?:\?[^\s<"]*)?', re.IGNORECASE),
]

USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'


def authenticate_gmail():
    """Authenticate with Gmail API using OAuth2."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'rb') as f:
            creds = pickle.load(f)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                print(f"\nERROR: {CREDENTIALS_FILE} not found.")
                print("\nTo set up Gmail API access:")
                print("1. Go to https://console.cloud.google.com")
                print("2. Create a project (or select existing)")
                print("3. Enable the Gmail API")
                print("4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID")
                print("5. Select 'Desktop app' as application type")
                print("6. Download the JSON and save as ~/gmail_credentials.json")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            try:
                creds = flow.run_local_server(
                    port=8080,
                    open_browser=True,
                )
            except Exception:
                # Fallback: print URL for manual auth
                flow.redirect_uri = 'urn:ietf:wg:oauth:2.0:oob'
                auth_url, _ = flow.authorization_url(prompt='consent')
                print(f"\n  Open this URL in your browser:\n\n  {auth_url}\n")
                code = input("  Enter the authorization code: ").strip()
                flow.fetch_token(code=code)
                creds = flow.credentials
        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)

    return build('gmail', 'v1', credentials=creds)


def search_emails(service, days=180):
    """Search Gmail for self-sent emails containing instagram/facebook links."""
    after_date = (datetime.now() - timedelta(days=days)).strftime('%Y/%m/%d')

    queries = [
        f'from:me to:me instagram.com after:{after_date}',
        f'from:me to:me facebook.com after:{after_date}',
        f'from:me to:me fb.watch after:{after_date}',
    ]

    all_message_ids = set()
    for query in queries:
        print(f"  Searching: {query}")
        page_token = None
        while True:
            kwargs = {'userId': 'me', 'q': query, 'maxResults': 500}
            if page_token:
                kwargs['pageToken'] = page_token
            results = service.users().messages().list(**kwargs).execute()
            messages = results.get('messages', [])
            for msg in messages:
                all_message_ids.add(msg['id'])
            page_token = results.get('nextPageToken')
            if not page_token:
                break

    print(f"  Found {len(all_message_ids)} emails with potential links")
    return list(all_message_ids)


def extract_links_from_message(service, msg_id):
    """Extract instagram/facebook links from a single email message."""
    msg = service.users().messages().get(userId='me', id=msg_id, format='full').execute()

    # Get date
    headers = msg.get('payload', {}).get('headers', [])
    date_str = next((h['value'] for h in headers if h['name'].lower() == 'date'), '')
    subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '(no subject)')

    # Extract body text
    body_text = ''
    payload = msg.get('payload', {})

    def get_body_parts(part):
        nonlocal body_text
        mime = part.get('mimeType', '')
        if 'text/plain' in mime or 'text/html' in mime:
            data = part.get('body', {}).get('data', '')
            if data:
                decoded = base64.urlsafe_b64decode(data).decode('utf-8', errors='replace')
                body_text += decoded + '\n'
        for sub in part.get('parts', []):
            get_body_parts(sub)

    get_body_parts(payload)

    # Find all matching links
    links = set()
    for pattern in LINK_PATTERNS:
        for match in pattern.finditer(body_text):
            url = match.group(0).rstrip('>')
            # Clean trailing punctuation
            url = url.rstrip('.,;:!?)\'\"')
            links.add(url)

    return {
        'message_id': msg_id,
        'date': date_str,
        'subject': subject,
        'links': list(links),
    }


def scrape_link_metadata(url):
    """Fetch a URL and extract Open Graph / meta tags for movie identification."""
    try:
        headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        metadata = {
            'url': url,
            'final_url': resp.url,
            'status': resp.status_code,
        }

        # Extract all meta tags
        for tag in soup.find_all('meta'):
            prop = tag.get('property', '') or tag.get('name', '')
            content = tag.get('content', '')
            if prop and content:
                metadata[prop] = content

        # Extract title tag
        title_tag = soup.find('title')
        if title_tag:
            metadata['page_title'] = title_tag.get_text(strip=True)

        # Extract visible text (captions, comments)
        # Look for common caption/description elements
        for selector in ['[data-testid="post-comment-root"]', '.x1lliihq', '._a9zs', '._aade']:
            elements = soup.select(selector)
            if elements:
                metadata['caption_text'] = ' '.join(e.get_text(' ', strip=True) for e in elements[:5])
                break

        # Fallback: grab all visible text in a truncated form
        if 'caption_text' not in metadata:
            body = soup.find('body')
            if body:
                text = body.get_text(' ', strip=True)[:2000]
                metadata['body_text_preview'] = text

        return metadata

    except requests.RequestException as e:
        return {
            'url': url,
            'error': str(e),
            'status': getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None,
        }


def analyze_metadata_for_movie(metadata):
    """
    Analyze scraped metadata to try to identify a movie title.
    Uses heuristics on OG tags, title, description, hashtags, and caption text.
    Returns (movie_title, confidence, reasoning) or (None, 0, reason).
    """
    # Gather all text to analyze
    text_sources = []
    for key in ['og:title', 'og:description', 'description', 'page_title',
                'caption_text', 'body_text_preview', 'twitter:title', 'twitter:description']:
        if key in metadata and metadata[key]:
            text_sources.append(metadata[key])

    combined_text = ' '.join(text_sources).lower()

    if not combined_text or len(combined_text) < 10:
        return None, 0, 'No text content found'

    # Extract hashtags
    hashtags = re.findall(r'#(\w+)', combined_text)

    # Common movie-related keywords
    movie_indicators = [
        'movie', 'film', 'watch', 'trailer', 'scene', 'cinema',
        'starring', 'directed by', 'netflix', 'hulu', 'prime video',
        'hbo', 'disney', 'marvel', 'dc', 'horror', 'thriller',
        'comedy', 'drama', 'action', 'romance', 'sci-fi',
        'moviename', 'whatmovie', 'movierecommendation', 'movietok',
        'movieclip', 'moviescene', 'filmtok', 'movierec',
    ]

    has_movie_context = any(kw in combined_text for kw in movie_indicators)

    # Look for patterns like "Movie: Title" or "🎬 Title"
    title_patterns = [
        re.compile(r'(?:movie|film|title|watch|name)[:\s-]+["\']?([A-Z][A-Za-z0-9\s:.\'-]{2,40})["\']?', re.IGNORECASE),
        re.compile(r'🎬\s*([A-Z][A-Za-z0-9\s:.\'-]{2,40})', re.IGNORECASE),
        re.compile(r'#(\w+movie\w*)', re.IGNORECASE),
    ]

    for pattern in title_patterns:
        match = pattern.search(' '.join(text_sources))
        if match:
            candidate = match.group(1).strip()
            if len(candidate) > 2 and candidate.lower() not in ['the', 'this', 'that', 'what', 'movie', 'film']:
                return candidate, 0.6, f'Pattern match in metadata: "{candidate}"'

    # Look in hashtags for potential movie titles (CamelCase hashtags)
    for tag in hashtags:
        # Split camelCase
        words = re.sub(r'([a-z])([A-Z])', r'\1 \2', tag)
        if len(words) > 3 and words.lower() not in ['instagram', 'facebook', 'reels', 'viral', 'foryou', 'fyp']:
            if any(kw in tag.lower() for kw in ['movie', 'film']):
                clean = re.sub(r'(?:movie|film|clip|scene|rec)', '', words, flags=re.IGNORECASE).strip()
                if clean:
                    return clean, 0.4, f'Extracted from hashtag: #{tag}'

    # If we have movie context but couldn't extract a title, flag for manual review
    if has_movie_context:
        # Try og:title as a last resort
        og_title = metadata.get('og:title', '')
        if og_title and 'instagram' not in og_title.lower() and 'facebook' not in og_title.lower():
            return og_title, 0.3, f'OG title with movie context: "{og_title}"'
        return None, 0, f'Movie context detected but title unclear. Keywords found in text.'

    return None, 0, 'No movie indicators found in metadata'


IMDB_SEARCH_URL = 'https://www.imdb.com/find/?q={}&s=tt&ttype=ft,tv'
IMDB_SUGGEST_URL = 'https://v2.sg.media-imdb.com/suggestion/h/{}.json'


def lookup_imdb(title, year=None):
    """Look up a movie/show on IMDB using the suggestion API.
    Returns (imdb_url, imdb_rating) tuple."""
    if not title or len(title) < 2:
        return None, None

    # Clean title for search
    clean = re.sub(r'[^\w\s]', '', title).strip().lower()

    def _pick_result(results, strict=True):
        for r in results:
            r_title = r.get('l', '').lower()
            r_year = r.get('y', 0)
            r_id = r.get('id', '')
            if not r_id.startswith('tt'):
                continue
            if strict:
                if r_title == title.lower():
                    if year and r_year and abs(int(year) - r_year) <= 1:
                        return r
                    elif not year:
                        return r
            else:
                if title.lower() in r_title or r_title in title.lower():
                    if year and r_year and abs(int(year) - r_year) <= 1:
                        return r
                    elif not year:
                        return r
        return None

    try:
        resp = requests.get(
            f'https://v2.sg.media-imdb.com/suggestion/h/{requests.utils.quote(clean)}.json',
            headers={'User-Agent': USER_AGENT},
            timeout=8,
        )
        if resp.status_code == 200:
            data = resp.json()
            results = data.get('d', [])

            # Try exact match first, then fuzzy, then first tt result
            match = _pick_result(results, strict=True)
            if not match:
                match = _pick_result(results, strict=False)
            if not match:
                for r in results:
                    if r.get('id', '').startswith('tt'):
                        match = r
                        break

            if match:
                imdb_url = f'https://www.imdb.com/title/{match["id"]}/'
                # Fetch rating from IMDB page
                rating = _fetch_imdb_rating(match['id'])
                return imdb_url, rating

    except Exception:
        pass

    return f'https://www.imdb.com/find/?q={requests.utils.quote(title)}&s=tt', None


def _fetch_imdb_rating(imdb_id):
    """Fetch the IMDB rating for a given title ID using the JSON-LD structured data."""
    try:
        resp = requests.get(
            f'https://www.imdb.com/title/{imdb_id}/',
            headers={
                'User-Agent': USER_AGENT,
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout=10,
        )
        if resp.status_code == 200:
            # Extract JSON-LD rating from page
            m = re.search(r'"ratingValue"\s*:\s*"?([\d.]+)"?', resp.text)
            if m:
                return m.group(1)
            # Fallback: look for aggregateRating pattern
            m = re.search(r'"aggregateRating".*?"ratingValue".*?([\d.]+)', resp.text, re.DOTALL)
            if m:
                return m.group(1)
    except Exception:
        pass
    return None


def batch_lookup_imdb(movies):
    """Look up IMDB URLs and ratings for a list of found movies. Modifies in place."""
    total = len(movies)
    for i, m in enumerate(movies):
        title = m.get('title')
        year = m.get('year')
        if not title:
            continue
        sys.stdout.write(f'\r  IMDB lookup {i+1}/{total}: {title[:40]}...')
        sys.stdout.flush()
        imdb_url, imdb_rating = lookup_imdb(title, year)
        if imdb_url:
            m['imdb_url'] = imdb_url
        if imdb_rating:
            m['imdb_rating'] = imdb_rating
        time.sleep(0.5)  # Rate limit (slightly slower since we fetch rating page too)
    print()


def generate_markdown(links_data, output_path):
    """Generate a raw links markdown file."""
    with open(output_path, 'w') as f:
        f.write('# Movie Links from Gmail\n\n')
        f.write(f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}\n\n')
        for i, item in enumerate(links_data, 1):
            f.write(f'## Email {i}: {item["subject"]}\n')
            f.write(f'**Date:** {item["date"]}\n\n')
            for link in item['links']:
                f.write(f'- {link}\n')
            f.write('\n')
    print(f"  Raw links saved to {output_path}")


def generate_html_report(found_movies, unfound_movies, output_path):
    """Generate an HTML report with collapsible found/unfound lists."""
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Movie Links Report</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 24px; max-width: 900px; margin: 0 auto; }}
  h1 {{ color: #fff; font-size: 28px; margin-bottom: 8px; }}
  .subtitle {{ color: #888; margin-bottom: 24px; font-size: 14px; }}
  .stats {{ display: flex; gap: 16px; margin-bottom: 24px; }}
  .stat {{ background: #1a1a2e; border: 1px solid #333; border-radius: 8px; padding: 16px 20px; flex: 1; text-align: center; }}
  .stat-num {{ font-size: 32px; font-weight: bold; }}
  .stat-num.found {{ color: #22c55e; }}
  .stat-num.unfound {{ color: #f97316; }}
  .stat-label {{ color: #888; font-size: 12px; text-transform: uppercase; margin-top: 4px; }}
  details {{ background: #1a1a2e; border: 1px solid #333; border-radius: 8px; margin-bottom: 12px; }}
  summary {{ cursor: pointer; padding: 16px 20px; font-size: 18px; font-weight: 600; user-select: none; list-style: none; display: flex; align-items: center; gap: 8px; }}
  summary::before {{ content: '\\25B6'; font-size: 12px; transition: transform 0.2s; }}
  details[open] > summary::before {{ transform: rotate(90deg); }}
  summary:hover {{ background: #222244; border-radius: 8px; }}
  .movie-list {{ padding: 0 20px 16px; }}
  .movie-item {{ border-top: 1px solid #2a2a3a; padding: 12px 0; }}
  .movie-item:first-child {{ border-top: none; }}
  .movie-title {{ font-size: 16px; font-weight: 600; color: #fff; }}
  .movie-year {{ color: #a855f7; font-size: 14px; margin-left: 8px; }}
  .movie-confidence {{ font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 8px; }}
  .conf-high {{ background: #166534; color: #86efac; }}
  .conf-med {{ background: #854d0e; color: #fde047; }}
  .conf-low {{ background: #7f1d1d; color: #fca5a5; }}
  .movie-meta {{ color: #888; font-size: 13px; margin-top: 4px; }}
  .movie-link {{ color: #3b82f6; text-decoration: none; font-size: 13px; word-break: break-all; }}
  .movie-link:hover {{ text-decoration: underline; }}
  .reasoning {{ color: #666; font-size: 12px; font-style: italic; margin-top: 4px; }}
  .badge {{ display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 10px; margin-left: 4px; }}
  .badge-ig {{ background: #831843; color: #f9a8d4; }}
  .badge-fb {{ background: #1e3a5f; color: #93c5fd; }}
  .imdb-rating {{ display: inline-block; background: #f5c518; color: #000; font-size: 12px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-left: 6px; }}
  .copy-btn {{ cursor: pointer; background: none; border: 1px solid #444; color: #888; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-left: 8px; transition: all 0.15s; }}
  .copy-btn:hover {{ border-color: #888; color: #fff; }}
  .copy-btn.copied {{ border-color: #22c55e; color: #22c55e; }}
</style>
<script>
function copyTitle(btn, text) {{
  navigator.clipboard.writeText(text).then(function() {{
    btn.textContent = 'copied!';
    btn.classList.add('copied');
    setTimeout(function() {{ btn.textContent = 'copy'; btn.classList.remove('copied'); }}, 1500);
  }});
}}
</script>
</head>
<body>
<h1>Movie Links Report</h1>
<p class="subtitle">Generated {datetime.now().strftime("%B %d, %Y at %I:%M %p")} from Gmail self-sent emails</p>

<div class="stats">
  <div class="stat">
    <div class="stat-num found">{len(found_movies)}</div>
    <div class="stat-label">Movies Found</div>
  </div>
  <div class="stat">
    <div class="stat-num unfound">{len(unfound_movies)}</div>
    <div class="stat-label">Unknown / Needs Review</div>
  </div>
  <div class="stat">
    <div class="stat-num" style="color: #3b82f6">{len(found_movies) + len(unfound_movies)}</div>
    <div class="stat-label">Total Links</div>
  </div>
</div>

<details open>
  <summary style="color: #22c55e;">Found Movies ({len(found_movies)})</summary>
  <div class="movie-list">
'''
    if not found_movies:
        html += '    <p style="color: #666; padding: 12px 0;">No movies identified yet. Try running with Claude analysis for better results.</p>\n'
    for m in found_movies:
        platform = 'ig' if 'instagram' in m['url'].lower() else 'fb'
        badge_class = f'badge-{platform}'
        badge_text = 'Instagram' if platform == 'ig' else 'Facebook'
        conf = m.get('confidence', 0)
        conf_class = 'conf-high' if conf >= 0.6 else 'conf-med' if conf >= 0.4 else 'conf-low'
        conf_label = 'High' if conf >= 0.6 else 'Medium' if conf >= 0.4 else 'Low'
        title_text = m.get('title', 'Unknown')
        year_val = m.get('year', '')
        imdb_url = m.get('imdb_url', '')
        imdb_rating = m.get('imdb_rating', '')
        copy_text = f'{title_text} {year_val}'.strip()
        copy_escaped = copy_text.replace("'", "\\'").replace('"', '&quot;')
        if imdb_url:
            title_html = f'<a href="{imdb_url}" target="_blank" style="color: #fff; text-decoration: none; border-bottom: 1px dotted #f5c518;">{title_text}</a> <a href="{imdb_url}" target="_blank" style="color: #f5c518; font-size: 11px; text-decoration: none; margin-left: 4px;" title="View on IMDB">IMDb</a>'
        else:
            title_html = title_text
        rating_html = f'<span class="imdb-rating">&#9733; {imdb_rating}</span>' if imdb_rating else ''
        copy_btn = f'<button class="copy-btn" onclick="copyTitle(this, \\'{copy_escaped}\\')">copy</button>'
        html += f'''    <div class="movie-item">
      <span class="movie-title">{title_html}</span>
      {rating_html}
      <span class="movie-confidence {conf_class}">{conf_label} confidence</span>
      <span class="badge {badge_class}">{badge_text}</span>
      {copy_btn}
      <div class="movie-meta">From email: {m.get('email_date', '')}</div>
      <div><a class="movie-link" href="{m['url']}" target="_blank">{m['url']}</a></div>
      <div class="reasoning">{m.get('reasoning', '')}</div>
    </div>
'''

    html += '''  </div>
</details>

<details>
  <summary style="color: #f97316;">Unknown / Needs Review (''' + str(len(unfound_movies)) + ''')</summary>
  <div class="movie-list">
'''
    if not unfound_movies:
        html += '    <p style="color: #666; padding: 12px 0;">All links were identified!</p>\n'
    for m in unfound_movies:
        platform = 'ig' if 'instagram' in m['url'].lower() else 'fb'
        badge_class = f'badge-{platform}'
        badge_text = 'Instagram' if platform == 'ig' else 'Facebook'
        html += f'''    <div class="movie-item">
      <span class="movie-title" style="color: #888;">Unknown Movie</span>
      <span class="badge {badge_class}">{badge_text}</span>
      <div class="movie-meta">From email: {m.get('email_date', '')} | Reason: {m.get('reasoning', 'Could not determine')}</div>
      <div><a class="movie-link" href="{m['url']}" target="_blank">{m['url']}</a></div>
    </div>
'''

    html += '''  </div>
</details>

</body>
</html>'''

    with open(output_path, 'w') as f:
        f.write(html)
    print(f"  HTML report saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description='Find movie links from Gmail self-sent emails')
    parser.add_argument('--days', type=int, default=180, help='Number of days to search back (default: 180)')
    parser.add_argument('--output', type=str, default=os.path.expanduser('~/movie_links.html'),
                        help='Output HTML file path (default: ~/movie_links.html)')
    parser.add_argument('--links-only', action='store_true',
                        help='Only extract links, skip metadata scraping')
    parser.add_argument('--json', type=str, default=None,
                        help='Also save raw data as JSON for Claude analysis')
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"  Movie Link Finder")
    print(f"  Searching last {args.days} days")
    print(f"{'='*60}\n")

    # Step 1: Authenticate
    print("[1/5] Authenticating with Gmail...")
    service = authenticate_gmail()
    print("  ✓ Authenticated\n")

    # Step 2: Search emails
    print("[2/5] Searching emails for Instagram/Facebook links...")
    message_ids = search_emails(service, days=args.days)
    if not message_ids:
        print("  No matching emails found. Done.")
        return
    print()

    # Step 3: Extract links from each email
    print("[3/5] Extracting links from emails...")
    all_links_data = []
    all_unique_links = []
    seen_urls = set()

    for i, msg_id in enumerate(message_ids):
        result = extract_links_from_message(service, msg_id)
        if result['links']:
            all_links_data.append(result)
            for link in result['links']:
                if link not in seen_urls:
                    seen_urls.add(link)
                    all_unique_links.append({
                        'url': link,
                        'email_date': result['date'],
                        'email_subject': result['subject'],
                    })
        sys.stdout.write(f"\r  Processed {i+1}/{len(message_ids)} emails, {len(all_unique_links)} unique links found")
        sys.stdout.flush()
    print()

    # Save raw links markdown
    md_path = os.path.expanduser('~/movie_links.md')
    generate_markdown(all_links_data, md_path)
    print()

    if args.links_only:
        print(f"  Links-only mode. {len(all_unique_links)} links saved to {md_path}")
        return

    # Step 4: Scrape metadata from each link
    print(f"[4/5] Scraping metadata from {len(all_unique_links)} links...")
    found_movies = []
    unfound_movies = []

    for i, link_info in enumerate(all_unique_links):
        url = link_info['url']
        sys.stdout.write(f"\r  Scraping {i+1}/{len(all_unique_links)}: {url[:60]}...")
        sys.stdout.flush()

        metadata = scrape_link_metadata(url)

        if 'error' in metadata:
            unfound_movies.append({
                **link_info,
                'reasoning': f"Failed to fetch: {metadata['error']}",
                'metadata': metadata,
            })
            continue

        title, confidence, reasoning = analyze_metadata_for_movie(metadata)

        entry = {
            **link_info,
            'title': title,
            'confidence': confidence,
            'reasoning': reasoning,
            'metadata': metadata,
        }

        if title and confidence >= 0.3:
            found_movies.append(entry)
        else:
            unfound_movies.append(entry)

    print(f"\n  ✓ Found {len(found_movies)} movies, {len(unfound_movies)} unknown\n")

    # Step 5: IMDB lookup for found movies
    print(f"[5/6] Looking up IMDB links for {len(found_movies)} found movies...")
    batch_lookup_imdb(found_movies)
    imdb_count = sum(1 for m in found_movies if m.get('imdb_url'))
    print(f"  ✓ Found IMDB links for {imdb_count}/{len(found_movies)} movies\n")

    # Step 6: Generate reports
    print("[6/6] Generating reports...")
    generate_html_report(found_movies, unfound_movies, args.output)

    # Optionally save JSON for Claude analysis
    json_path = args.json or os.path.expanduser('~/movie_links_data.json')
    with open(json_path, 'w') as f:
        json.dump({
            'found': found_movies,
            'unfound': unfound_movies,
            'generated': datetime.now().isoformat(),
            'days_searched': args.days,
        }, f, indent=2, default=str)
    print(f"  JSON data saved to {json_path}")

    print(f"\n{'='*60}")
    print(f"  Done! Results:")
    print(f"    Movies found:   {len(found_movies)}")
    print(f"    Unknown:        {len(unfound_movies)}")
    print(f"    HTML report:    {args.output}")
    print(f"    Raw links:      {md_path}")
    print(f"    JSON data:      {json_path}")
    print(f"{'='*60}\n")
    print("  Tip: For better movie identification, run:")
    print("    /find-movies analyze")
    print("  to have Claude analyze the unknown links using AI.\n")


if __name__ == '__main__':
    main()
