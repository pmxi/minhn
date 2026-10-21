import assert from "node:assert/strict";
import test from "node:test";
import { pacificDate, shiftDate, dayBounds, storiesUrl, fetchStories } from "../src/stories.mjs";

test("dates follow the Pacific calendar across UTC midnight and year boundaries", () => {
  assert.equal(pacificDate(new Date("2026-10-21T06:59:59Z")), "2026-10-20");
  assert.equal(pacificDate(new Date("2026-10-21T07:00:00Z")), "2026-10-21");
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
});

test("Pacific midnight boundaries handle ordinary and both DST transition days", () => {
  for (const [date, start, end] of [
    ["2026-10-20", "2026-10-20T07:00:00Z", "2026-10-21T07:00:00Z"],
    ["2026-03-08", "2026-03-08T08:00:00Z", "2026-03-09T07:00:00Z"],
    ["2026-11-01", "2026-11-01T07:00:00Z", "2026-11-02T08:00:00Z"],
  ]) {
    assert.deepEqual(dayBounds(date), [Date.parse(start) / 1000, Date.parse(end) / 1000]);
  }
});

test("query ranks before limiting to ten even when a day exceeds 1,000 stories", async () => {
  const hits = Array.from({ length: 10 }, (_, index) => ({
    objectID: String(50163277 + index), title: `Story ${index}`, points: 2222 - index,
  }));
  let calls = 0;
  const stories = await fetchStories("2026-10-20", async (url, options) => {
    calls += 1;
    assert.equal(url.pathname, "/api/v1/search");
    assert.equal(url.searchParams.has("query"), false);
    assert.equal(url.searchParams.get("tags"), "story");
    assert.equal(url.searchParams.get("hitsPerPage"), "10");
    assert.equal(url.searchParams.get("numericFilters"), "created_at_i>=1792479600,created_at_i<1792566000");
    assert.equal(options.cache, "no-store");
    return { ok: true, json: async () => ({ hits, nbHits: 1284, nbPages: 100 }) };
  });
  assert.equal(calls, 1);
  assert.equal(stories.length, 10);
  assert.equal(stories[0].id, 50163277);
  assert.equal(storiesUrl("2026-10-20").searchParams.get("attributesToRetrieve"), "objectID,title,points");
});

test("revisiting a day fetches updated scores without caching", async () => {
  let points = 10;
  const fetchImpl = async () => ({ ok: true, json: async () => ({
    hits: [{ objectID: "1", title: "Story", points: points++ }],
  }) });
  assert.equal((await fetchStories("2026-10-21", fetchImpl))[0].points, 10);
  assert.equal((await fetchStories("2026-10-21", fetchImpl))[0].points, 11);
});

test("API ordering is retained for equal scores", async () => {
  const hits = [2, 1].map((id) => ({ objectID: String(id), title: "Tie", points: 5 }));
  assert.deepEqual((await fetchStories("2026-10-20", async () => ({
    ok: true, json: async () => ({ hits }),
  }))).map((story) => story.id), [2, 1]);
});

test("HTTP and invalid-response failures allow a later retry", async () => {
  await assert.rejects(fetchStories("2026-10-20", async () => ({ ok: false })), /retry/);
  await assert.rejects(fetchStories("2026-10-20", async () => ({
    ok: true, json: async () => ({}),
  })), /retry/);
  assert.deepEqual(await fetchStories("2026-10-20", async () => ({
    ok: true, json: async () => ({ hits: [] }),
  })), []);
});
