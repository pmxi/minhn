# Roadmap

integrate AI!!!!

# MINHN

MINHN is a minimum Hacker News viewer.

- Single page only.
- Shows only a list of links to Hacker News discussion pages with point totals.
- No comment counts, author names, or other metadata.
- Displays up to 10 stories from each midnight-to-midnight Pacific calendar day, ranked by points descending. DST transition days contain 23 or 25 hours.
- Date selection is a plain horizontal row of day links for the latest 7 PT days, not a date picker.

## Run

Generate the ranking snapshot with Python 3.9+ (no third-party dependencies), then serve the static app from `src`.

```bash
python3 scripts/build_rankings.py
python3 -m http.server 8000 --directory src
```

Then open [http://localhost:8000](http://localhost:8000).

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow at
`.github/workflows/deploy.yml` that tests, generates rankings, and publishes this static site on pushes to `master`, manually, and at minutes 7, 27, and 47 of each hour. Scheduled runs first check the published snapshot and skip the build/deploy if it is less than 50 minutes old and already includes the current Pacific day. Pushes and manual runs always rebuild. The extra trigger opportunities reduce the impact of missed events, but GitHub may still delay or drop scheduled runs; this is not a guaranteed hourly service. A failed fetch or build prevents deployment, leaving the last successful snapshot live.

One-time setup in GitHub:

1. Go to **Settings -> Pages** for the repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `master` and wait for the **Deploy to GitHub Pages** workflow to finish.

After deployment, the site is available at:

- `https://<your-username>.github.io/<repo-name>/`

## Data source

Uses the public Hacker News search index:

- [HN Search API](https://hn.algolia.com/api)

Implementation detail:

- `scripts/build_rankings.py` fetches all stories whose `created_at_i` falls inside each of the latest seven Pacific days (`America/Los_Angeles`). It compares `nbHits` with the returned hit count and recursively splits truncated time windows; Algolia caps queries at 1,000 hits even when `nbPages` reports 1.
- Stories are sorted by points descending, then submission time descending. Only each day's top 10 (ID, title, and points) are written to `src/rankings.json`, along with the generation time and Pacific dates.
- The generated file is ignored by Git and included in the Pages deployment artifact. There is no running application server, database, or direct browser request to Algolia.
- The browser loads the snapshot once and switches days locally. Date navigation follows the snapshot so a delayed refresh cannot offer a day with no published data.
- Rankings reflect points at the last refresh, not a historical end-of-day score snapshot. The page displays the refresh timestamp and flags snapshots over two hours old. The warning updates while a tab stays open; reload to fetch a newer snapshot.

## Tests

```bash
python3 -m unittest discover -s tests -v
```
