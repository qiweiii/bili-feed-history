const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
// Reuse the DOM implementation already present in WXT's dependency tree.
const { parseHTML } = require("../node_modules/.pnpm/node_modules/linkedom");

function fixture() {
  const { document } = parseHTML(`<html><head></head><body>
    <div class="container">
      <div class="recommended-swipe"><button>carousel</button></div>
      <div class="feed-card"><a href="/video/live1">Live one</a></div>
      <div class="feed-card" style="display:none"><a href="/video/live2">Live two</a></div>
      <div class="floor-single-card">Live stream</div>
    </div></body></html>`);
  const context = vm.createContext({ document, location: { pathname: "/" } });
  function load(name, dependencies = {}) {
    const source = readFileSync(`${__dirname}/../entrypoints/content/${name}.ts`, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    const run = vm.runInContext(`(function(exports, require) { ${output}\n })`, context);
    run(exports, (key) => dependencies[key]);
    return exports;
  }
  const feed = load("feed");
  const navigation = load("navigation", { "./feed": feed, "./storage": {} });
  return { document, feed, navigation, load, context };
}

function captureFixture() {
  const env = fixture();
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const saves = [];
  env.context.Date = { now: () => now };
  env.context.URL = URL;
  env.context.console = console;
  env.context.window = {
    setTimeout: (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
  };
  env.context.clearTimeout = (id) => timers.delete(id);
  const capture = env.load("capture", {
    "./feed": env.feed,
    "./storage": {
      saveFeedItems: async () => saves.push(env.feed.serializeFeedCards(env.feed.getLiveFeedCards())),
    },
  });
  const advance = (duration) => {
    const end = now + duration;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = end;
  };
  return { ...env, capture, advance, saves, timers };
}

test("refresh delayed beyond five seconds is captured once after settling", () => {
  const env = captureFixture();
  env.capture.startFeedCapture();
  env.advance(7000);
  assert.equal(env.saves.length, 0);
  env.document.querySelector("a").setAttribute("href", "/video/new");
  env.advance(250);
  env.capture.startFeedCapture();
  env.advance(500);
  assert.equal(env.saves.length, 1);
  assert.match(env.saves[0], /\/video\/new/);
  assert.equal(env.timers.size, 0);
});

test("a late initial feed is saved and ongoing card changes restart settling", () => {
  const env = captureFixture();
  const container = env.document.querySelector(".container");
  env.feed.getLiveFeedCards().forEach((card) => card.remove());
  env.capture.startFeedCapture(true);
  env.advance(6000);
  assert.equal(env.saves.length, 0);
  container.innerHTML = '<div class="feed-card"><a href="/video/a">A</a></div>';
  env.advance(500);
  container.querySelector("a").setAttribute("href", "/video/b");
  env.advance(500);
  assert.equal(env.saves.length, 0);
  env.advance(250);
  assert.equal(env.saves.length, 1);
  assert.match(env.saves[0], /\/video\/b/);
});

test("empty loading state is not saved and cleanup cancels pending capture", () => {
  const env = captureFixture();
  env.capture.startFeedCapture();
  env.feed.getLiveFeedCards().forEach((card) => { card.innerHTML = ""; });
  env.advance(2000);
  assert.equal(env.saves.length, 0);
  env.capture.stopFeedCapture();
  assert.equal(env.timers.size, 0);
  env.advance(60000);
  assert.equal(env.saves.length, 0);
});

test("failed refresh stops polling and leaving home prevents saving", () => {
  const env = captureFixture();
  env.capture.startFeedCapture();
  env.advance(11000);
  assert.equal(env.timers.size, 0);
  assert.equal(env.saves.length, 0);
  env.capture.startFeedCapture();
  env.context.location.pathname = "/video/example";
  env.advance(250);
  assert.equal(env.timers.size, 0);
  assert.equal(env.saves.length, 0);
});

test("storage initialization preserves existing history and queued saves retain both feeds", async () => {
  const env = fixture();
  let value = { items: [{ id: "existing", html: "existing", timestamp: 1 }], currentIndex: 0 };
  env.context.storage = {
    defineItem: () => ({
      getValue: async () => structuredClone(value),
      setValue: async (next) => { value = structuredClone(next); },
    }),
  };
  const storage = env.load("storage", { "./feed": env.feed });
  await storage.setupStorage();
  assert.equal(value.items.length, 1);
  const first = storage.saveFeedItems();
  env.document.querySelector("a").setAttribute("href", "/video/new");
  const second = storage.saveFeedItems();
  await Promise.all([first, second]);
  assert.equal(value.items.length, 3);
  assert.equal(value.items[0].id, "existing");
  assert.match(value.items[1].html, /\/video\/live1/);
  assert.match(value.items[2].html, /\/video\/new/);
  await storage.saveFeedItems();
  assert.equal(value.items.length, 3);
});

test("history preserves the live grid, carousel, and original card nodes", () => {
  const { document, feed, navigation } = fixture();
  const container = document.querySelector(".container");
  const children = [...container.children];
  const originals = feed.getLiveFeedCards();
  const originalMarkup = container.innerHTML;
  navigation.replaceFeeds({ html: '<div class="feed-card">History one</div><div class="feed-card">History two</div>' });
  assert.deepEqual([...container.children], children);
  assert.equal(originals[0].querySelector("a").textContent, "Live one");
  assert.equal(originals[1].style.display, "none");
  assert.equal(feed.getLiveFeedCards().length, 2);
  assert.equal(document.querySelectorAll("[data-bili-feed-history-card]").length, 2);
  navigation.exitHistoryView();
  assert.equal(container.innerHTML, originalMarkup);
  assert.equal(document.head.children.length, 0);
});

test("saving during history view excludes overlays, carousel, and live-stream tiles", () => {
  const { feed, navigation } = fixture();
  const before = feed.serializeFeedCards(feed.getLiveFeedCards());
  navigation.replaceFeeds({ html: '<div class="feed-card">Historical video</div>' });
  const after = feed.serializeFeedCards(feed.getLiveFeedCards());
  assert.equal(after, before);
  assert.doesNotMatch(after, /carousel|Live stream|Historical video|data-bili-feed-history/);
});

test("old whole-container snapshots display only cards and repeated navigation cleans up", () => {
  const { document, navigation } = fixture();
  const item = {
    format: "feed-container",
    html: '<div class="recommended-swipe">Old carousel</div><div class="feed-card">Old card</div><div class="floor-single-card">Old stream</div>',
  };
  for (let i = 0; i < 5; i++) navigation.replaceFeeds(item);
  assert.equal(document.querySelectorAll(".recommended-swipe").length, 1);
  assert.equal(document.querySelectorAll("[data-bili-feed-history-card]").length, 1);
  assert.equal(document.head.children.length, 1);
  assert.doesNotMatch(document.body.textContent, /Old carousel|Old stream/);
  navigation.exitHistoryView();
  assert.equal(document.querySelectorAll("[data-bili-feed-history-card]").length, 0);
});
