from datetime import datetime, timedelta, timezone
import unittest

from scripts.refresh_due import refresh_due


class FreshnessTests(unittest.TestCase):
    def test_refresh_threshold(self):
        now = datetime(2026, 10, 21, 17, tzinfo=timezone.utc)
        for minutes, expected in [(0, False), (49, False), (50, True), (240, True), (-10, True)]:
            with self.subTest(minutes=minutes):
                snapshot = {"generatedAt": (now - timedelta(minutes=minutes)).isoformat(),
                            "days": [{"date": "2026-10-21"}]}
                self.assertEqual(refresh_due(snapshot, now), expected)

    def test_new_pacific_day_refreshes_even_recent_snapshot(self):
        snapshot = {"generatedAt": "2026-10-21T06:55:00+00:00",
                    "days": [{"date": "2026-10-20"}]}
        self.assertTrue(refresh_due(snapshot, datetime(2026, 10, 21, 7, 5, tzinfo=timezone.utc)))

    def test_invalid_snapshot_rebuilds(self):
        now = datetime.now(timezone.utc)
        for snapshot in ({}, None, {"generatedAt": "invalid"},
                         {"generatedAt": now.isoformat(), "days": []}):
            with self.subTest(snapshot=snapshot):
                self.assertTrue(refresh_due(snapshot, now))
