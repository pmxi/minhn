const PACIFIC_TIME_ZONE = "America/Los_Angeles";
const dateNav = document.getElementById("dateNav");
const windowLabel = document.getElementById("windowLabel");
const statusText = document.getElementById("status");
const updatedText = document.getElementById("updated");
const headlinesList = document.getElementById("headlines");
let rankingDays = new Map();

function dateLabel(dateValue, options) {
  // The dates in the snapshot are already Pacific calendar dates. Format at
  // UTC noon to preserve that date regardless of the reader's time zone.
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" })
    .format(new Date(`${dateValue}T12:00:00Z`));
}

function buildDateLinks(days) {
  dateNav.textContent = "";
  for (const { date } of days) {
    const link = document.createElement("a");
    link.href = "#";
    link.dataset.date = date;
    link.textContent = dateLabel(date, { month: "short", day: "numeric" });
    dateNav.appendChild(link);
  }
}

function setActiveDateLink(dateValue) {
  const links = dateNav.querySelectorAll("a[data-date]");

  for (const link of links) {
    const isActive = link.dataset.date === dateValue;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "date");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function renderHeadlines(items, { showEmpty = true } = {}) {
  headlinesList.textContent = "";

  if (!items.length && showEmpty) {
    const empty = document.createElement("li");
    empty.textContent = "No stories found for this Pacific day yet.";
    headlinesList.appendChild(empty);
    return;
  }

  for (const story of items) {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = `https://news.ycombinator.com/item?id=${story.id}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = story.title;
    li.appendChild(link);
    li.appendChild(document.createTextNode(" "));

    const points = document.createElement("span");
    points.className = "story-points";
    points.textContent = `(${formatPointsLabel(story.points)})`;
    li.appendChild(points);
    headlinesList.appendChild(li);
  }
}

function formatPointsLabel(points) {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

function showDay(dateValue) {
  const stories = rankingDays.get(dateValue);
  if (!stories) return;
  setActiveDateLink(dateValue);
  const label = dateLabel(dateValue, { weekday: "short", month: "short", day: "numeric" });
  windowLabel.textContent = `Top 10 by points for ${label} (PT)`;
  renderHeadlines(stories);
}

dateNav.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-date]");
  if (!link) return;
  event.preventDefault();
  showDay(link.dataset.date);
});

async function loadRankings() {
  statusText.textContent = "Loading ranked stories...";
  const response = await fetch("rankings.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Unable to load rankings. Please try again later.");
  const snapshot = await response.json();
  if (!Array.isArray(snapshot.days) || !snapshot.days.length) {
    throw new Error("Rankings are unavailable. Please try again later.");
  }
  rankingDays = new Map(snapshot.days.map(({ date, stories }) => [date, stories]));
  buildDateLinks(snapshot.days);
  const updated = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(snapshot.generatedAt));
  updatedText.textContent = `Updated ${updated} PT · Refreshes hourly`;
  statusText.textContent = "";
  // Use the latest published day, including when a scheduled refresh is late.
  showDay(snapshot.days[snapshot.days.length - 1].date);
}

loadRankings().catch((error) => {
  statusText.textContent = error instanceof Error ? error.message : "Failed to load rankings.";
});
