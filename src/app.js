import { pacificDate, shiftDate, fetchStories } from "./stories.mjs";

const dateNav = document.getElementById("dateNav");
const windowLabel = document.getElementById("windowLabel");
const statusText = document.getElementById("status");
const headlinesList = document.getElementById("headlines");
let latestRequest = 0;

function dateLabel(dateValue, options) {
  // These are Pacific calendar dates. Format at
  // UTC noon to preserve that date regardless of the reader's time zone.
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" })
    .format(new Date(`${dateValue}T12:00:00Z`));
}

function buildDateLinks(days) {
  dateNav.textContent = "";
  for (const date of days) {
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

async function showDay(date) {
  const request = ++latestRequest;
  setActiveDateLink(date);
  const label = dateLabel(date, { weekday: "short", month: "short", day: "numeric" });
  windowLabel.textContent = `Top 10 by points for ${label} (PT)`;
  statusText.textContent = "Loading ranked stories...";
  renderHeadlines([], { showEmpty: false });
  try {
    const stories = await fetchStories(date);
    // A slower response for a previously selected day must not replace the
    // current selection, including when the user selects the same day again.
    if (request !== latestRequest) return;
    renderHeadlines(stories);
    statusText.textContent = "";
  } catch (error) {
    if (request !== latestRequest) return;
    statusText.textContent = error instanceof Error ? error.message : "Failed to load stories.";
  }
}

function refreshDateLinks() {
  const today = pacificDate();
  buildDateLinks(Array.from({ length: 7 }, (_, index) => shiftDate(today, index - 6)));
  return today;
}

dateNav.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-date]");
  if (!link) return;
  event.preventDefault();
  const date = link.dataset.date;
  refreshDateLinks();
  showDay(date);
});

showDay(refreshDateLinks());
