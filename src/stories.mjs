export const PACIFIC_TIME_ZONE = "America/Los_Angeles";

export function pacificDate(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(reference);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function shiftDate(date, offset) {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

function pacificMidnight(date) {
  const target = Date.parse(`${date}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let instant = target;
  // Resolve the Pacific clock to UTC independently for each midnight, so
  // daylight-saving transition days naturally span 23 or 25 hours.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]));
    const clock = Date.UTC(parts.year, parts.month - 1, parts.day,
      parts.hour, parts.minute, parts.second);
    if (clock === target) return instant / 1000;
    instant += target - clock;
  }
  throw new Error("Unable to determine the Pacific day window.");
}

export function dayBounds(date) {
  return [pacificMidnight(date), pacificMidnight(shiftDate(date, 1))];
}

export function storiesUrl(date) {
  const [start, end] = dayBounds(date);
  const url = new URL("https://hn.algolia.com/api/v1/search");
  // With no text query, /search ranks by points, then comment count.
  // Rank in the index before limiting results, avoiding the 1,000-hit cutoff.
  url.searchParams.set("tags", "story");
  url.searchParams.set("numericFilters", `created_at_i>=${start},created_at_i<${end}`);
  url.searchParams.set("hitsPerPage", "10");
  url.searchParams.set("attributesToRetrieve", "objectID,title,points");
  url.searchParams.set("attributesToHighlight", "[]");
  return url;
}

export async function fetchStories(date, fetchImpl = fetch) {
  const response = await fetchImpl(storiesUrl(date), { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load stories. Select the day again to retry.");
  const data = await response.json();
  if (!Array.isArray(data.hits)) throw new Error("Invalid story response. Select the day again to retry.");
  return data.hits.map((hit) => ({
    id: Number(hit.objectID), title: hit.title, points: hit.points ?? 0,
  })).filter((story) => Number.isSafeInteger(story.id) && story.id > 0
    && typeof story.title === "string" && story.title.length > 0);
}
