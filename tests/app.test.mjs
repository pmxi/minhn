import assert from "node:assert/strict";
import test from "node:test";

test("late responses and errors cannot replace the selected day; same-day clicks retry", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const requests = [];
  class Element {
    children = [];
    dataset = {};
    classList = { toggle() {} };
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text; }
    appendChild(child) { this.children.push(child); }
    querySelectorAll() { return this.children; }
    setAttribute() {}
    removeAttribute() {}
    addEventListener(name, handler) { this[name] = handler; }
  }
  const elements = Object.fromEntries(["dateNav", "windowLabel", "status", "headlines"]
    .map((id) => [id, new Element()]));
  globalThis.document = {
    getElementById: (id) => elements[id],
    createElement: () => new Element(),
    createTextNode: (text) => text,
  };
  globalThis.fetch = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  const click = (date) => elements.dateNav.click({
    preventDefault() {}, target: { closest: () => ({ dataset: { date } }) },
  });
  const respond = async (request, title) => {
    request.resolve({ ok: true, json: async () => ({ hits: [{ objectID: "1", title, points: 10 }] }) });
    await new Promise(setImmediate);
  };
  try {
    await import("../src/app.js");
    click("2026-10-20");
    await respond(requests[1], "Selected day");
    await respond(requests[0], "Outdated day");
    assert.equal(elements.headlines.children[0].children[0].textContent, "Selected day");
    click("2026-10-20");
    assert.equal(requests.length, 3);
    click("2026-10-19");
    await respond(requests[3], "Latest selection");
    requests[2].reject(new Error("Old request failed"));
    await new Promise(setImmediate);
    assert.equal(elements.status.textContent, "");
    assert.equal(elements.headlines.children[0].children[0].textContent, "Latest selection");
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
  }
});
