from datetime import date, datetime, timezone
import unittest

from scripts.build_rankings import build_snapshot, day_bounds, fetch_all_stories, rank_stories


def story(ident, timestamp, points=1):
    return {"objectID": str(ident), "title": f"Story {ident}",
            "created_at_i": timestamp, "points": points}


class RankingsTests(unittest.TestCase):
    def test_recovers_early_winner_despite_one_reported_page(self):
        hits = [story(i + 1, i, 2222 if i == 0 else 1) for i in range(1284)]
        calls = []

        def capped_search(start, end):
            calls.append((start, end))
            matching = [h for h in reversed(hits) if start <= h["created_at_i"] < end]
            return {"hits": matching[:1000], "nbHits": len(matching), "nbPages": 1}

        full = fetch_all_stories(0, 1284, capped_search)
        self.assertEqual(len(full), 1284)
        self.assertEqual(len({h["objectID"] for h in full}), 1284)
        self.assertEqual(rank_stories(full)[0]["id"], 1)
        self.assertEqual(calls, [(0, 1284), (0, 642), (642, 1284)])

    def test_small_window_needs_only_one_request(self):
        calls = []

        def search(start, end):
            calls.append((start, end))
            return {"hits": [story(1, start)], "nbHits": 1}

        self.assertEqual(len(fetch_all_stories(0, 100, search)), 1)
        self.assertEqual(calls, [(0, 100)])

    def test_incomplete_or_invalid_results_fail_instead_of_publishing(self):
        for payload in ({"hits": [], "nbHits": 1001}, {"error": "unavailable"}):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                fetch_all_stories(0, 1, lambda *_: payload)

    def test_pacific_calendar_days_include_dst_changes(self):
        for day, hours in [(date(2026, 3, 8), 23), (date(2026, 11, 1), 25),
                           (date(2026, 10, 20), 24)]:
            start, end = day_bounds(day)
            self.assertEqual(end - start, hours * 3600)

    def test_snapshot_dates_follow_pacific_time_not_utc(self):
        snapshot = build_snapshot(datetime(2026, 10, 21, 1, tzinfo=timezone.utc),
                                  lambda *_: {"hits": [], "nbHits": 0})
        self.assertEqual(len(snapshot["days"]), 7)
        self.assertEqual(snapshot["days"][0]["date"], "2026-10-14")
        self.assertEqual(snapshot["days"][-1]["date"], "2026-10-20")

    def test_ranking_uses_points_then_newest_and_returns_only_ten(self):
        hits = [story(i, i, i // 2) for i in range(20)]
        hits += [hits[-1], {"title": None}]
        self.assertEqual([s["id"] for s in rank_stories(hits)], list(range(19, 9, -1)))


if __name__ == "__main__":
    unittest.main()
