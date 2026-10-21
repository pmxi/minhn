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

Serve the static app from `src`. There is no build step or dependency installation.

```bash
python3 -m http.server 8000 --directory src
```

Then open [http://localhost:8000](http://localhost:8000).

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow at
`.github/workflows/deploy.yml` that runs the JavaScript tests and publishes `src` on pushes to `master` or a manual dispatch. There are no scheduled jobs or generated data files.

One-time setup in GitHub:

1. Go to **Settings -> Pages** for the repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `master` and wait for the **Deploy to GitHub Pages** workflow to finish.

After deployment, the site is available at:

- `https://<your-username>.github.io/<repo-name>/`

## Data source

Uses the public Hacker News search index:

- [HN Search API](https://hn.algolia.com/api)

Implementation details:

- The browser uses `/api/v1/search` with no text query, `tags=story`, Pacific midnight timestamp bounds, and `hitsPerPage=10`. The API ranks by points, then comment count. Rankings are not historical end-of-day snapshots.
- Ranking happens in the search index before the result limit. Even on days with over 1,000 stories, early high-scoring submissions can appear in the top 10. No pagination or bulk download is needed.
- Only ID, title, and points are requested, with highlighting disabled to keep responses small.
- Every day selection (including the already-selected day) and page reload makes a fresh request with `cache: "no-store"`. There is no application cache or automatic polling; the API's own indexing delay can still affect freshness.
- Pacific midnight bounds are computed separately for each date, accounting for 23- and 25-hour daylight-saving days.
- Requests that finish after a newer selection cannot overwrite that selection. Failed requests show an error and can be retried by selecting the day again.

## Tests

Use Node.js 24; no packages are required.

```bash
node --test tests/*.test.mjs
```
