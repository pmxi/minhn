"""Let scheduled runs skip rebuilding a recently published snapshot."""

from datetime import datetime, timedelta, timezone
import json
import sys
from urllib.request import Request, urlopen

from scripts.build_rankings import PACIFIC


def refresh_due(snapshot, now):
    try:
        generated = datetime.fromisoformat(snapshot["generatedAt"])
        age = now - generated
        latest_day = snapshot["days"][-1]["date"]
        return (age < timedelta(0) or age >= timedelta(minutes=50)
                or latest_day != now.astimezone(PACIFIC).date().isoformat())
    except (KeyError, TypeError, ValueError, IndexError):
        return True


def main():
    now = datetime.now(timezone.utc)
    # Avoid a cached CDN response deciding whether a build is necessary.
    url = f"https://pmxi.github.io/minhn/rankings.json?freshness={int(now.timestamp())}"
    try:
        with urlopen(Request(url, headers={"Cache-Control": "no-cache"}), timeout=20) as response:
            due = refresh_due(json.load(response), now)
    except Exception as error:
        print(f"Unable to check published snapshot; rebuilding: {error}", file=sys.stderr)
        due = True
    print("true" if due else "false")


if __name__ == "__main__":
    main()
