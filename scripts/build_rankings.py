"""Build the small, shared ranking snapshot published with GitHub Pages."""

import argparse
from datetime import datetime, time, timedelta, timezone
import json
from pathlib import Path
import time as clock
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo


PACIFIC = ZoneInfo("America/Los_Angeles")
SEARCH_URL = "https://hn.algolia.com/api/v1/search_by_date"
PAGE_SIZE = 1000


def fetch_window(start, end):
    query = urlencode({
        "tags": "story",
        "numericFilters": f"created_at_i>={start},created_at_i<{end}",
        "hitsPerPage": PAGE_SIZE,
        "page": 0,
    })
    for attempt in range(3):
        try:
            with urlopen(f"{SEARCH_URL}?{query}", timeout=45) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError):
            if attempt == 2:
                raise
            clock.sleep(2 ** attempt)


def fetch_all_stories(start, end, fetch=fetch_window):
    data = fetch(start, end)
    hits = data.get("hits")
    count = data.get("nbHits")
    if not isinstance(hits, list) or type(count) is not int or count < len(hits):
        raise ValueError("Search API returned an invalid result")

    # nbPages can be 1 even when more than 1,000 stories matched. Split the
    # time range instead of trusting pagination, with no overlap at boundaries.
    exhaustive = data.get("exhaustiveNbHits", True)
    if count == len(hits) and exhaustive:
        return hits
    if end - start <= 1:
        raise ValueError("Cannot retrieve every story in a one-second window")
    midpoint = (start + end) // 2
    return (fetch_all_stories(start, midpoint, fetch)
            + fetch_all_stories(midpoint, end, fetch))


def day_bounds(day):
    start = datetime.combine(day, time.min, PACIFIC)
    end = datetime.combine(day + timedelta(days=1), time.min, PACIFIC)
    return int(start.timestamp()), int(end.timestamp())


def rank_stories(hits):
    stories = {}
    for hit in hits:
        title = hit.get("title")
        if not isinstance(title, str) or not title:
            continue
        ident = int(hit.get("story_id") or hit["objectID"])
        stories[ident] = {
            "id": ident,
            "title": title,
            "points": hit.get("points") or 0,
            "createdAtUnix": hit["created_at_i"],
        }
    ranked = sorted(stories.values(), key=lambda s: (-s["points"], -s["createdAtUnix"]))
    return [{key: story[key] for key in ("id", "title", "points")}
            for story in ranked[:10]]


def build_snapshot(now=None, fetch=fetch_window):
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(PACIFIC).date()
    days = []
    for offset in range(-6, 1):
        day = today + timedelta(days=offset)
        start, end = day_bounds(day)
        hits = fetch_all_stories(start, end, fetch)
        days.append({"date": day.isoformat(), "stories": rank_stories(hits)})
        print(f"{day}: fetched {len(hits)} stories", flush=True)
    return {
        "generatedAt": now.isoformat(),
        "timeZone": "America/Los_Angeles",
        "days": days,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("src/rankings.json"))
    args = parser.parse_args()
    # Finish the entire snapshot before replacing anything. Failed builds do
    # not deploy, so the previous complete snapshot stays available to readers.
    snapshot = build_snapshot()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(args.output)


if __name__ == "__main__":
    main()
