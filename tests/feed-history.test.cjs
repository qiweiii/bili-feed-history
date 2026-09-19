const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
// Reuse the DOM implementation already present in WXT's dependency tree.
const { parseHTML } = require("../node_modules/.pnpm/node_modules/linkedom");

function fixture() {
	const { document, window: domWindow } = parseHTML(`<html><head></head><body>
    <div class="container">
      <div class="recommended-swipe"><button>carousel</button></div>
      <div class="feed-card"><a href="/video/live1">Live one</a></div>
      <div class="feed-card" style="display:none"><a href="/video/live2">Live two</a></div>
      <div class="floor-single-card">Live stream</div>
    </div></body></html>`);
	const context = vm.createContext({
	 browser: { runtime: { getManifest: () => ({ version: "1.0.2" }) } },
		document,
		URL,
		Element: domWindow.Element,
		HTMLButtonElement: domWindow.HTMLButtonElement,
		Event: domWindow.Event,
		getComputedStyle: (node) => node.style,
		location: { pathname: "/" },
		window: {
			addEventListener() {},
			removeEventListener() {},
			scrollX: 0,
			scrollY: 0,
		},
	});
	let adapter;
	function load(name, dependencies = {}) {
		const source = readFileSync(
			`${__dirname}/../entrypoints/content/${name}.ts`,
			"utf8",
		);
		const output = ts.transpileModule(
			source.replaceAll("import.meta.env", "testEnv"),
			{
				compilerOptions: {
					module: ts.ModuleKind.CommonJS,
					target: ts.ScriptTarget.ES2022,
				},
			},
		).outputText;
		const exports = {};
		const run = vm.runInContext(
			`(function(exports, require) { ${output}\n })`,
			context,
		);
		run(exports, (key) => {
			const dependency =
				key === "./bilibili" ? adapter : dependencies[key];
			if (key !== "./debug") return dependency;
			return {
				trace() {},
				traceHtml() {},
				addDebugButton() {},
				...dependency,
			};
		});
		return exports;
	}
	adapter = load("bilibili");
	const feed = load("feed");
	const navigation = load("navigation", { "./feed": feed, "./storage": {} });
	return { document, feed, navigation, load, context, adapter };
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
	env.context.window.setTimeout = (callback, delay) => {
			const id = ++nextId;
			timers.set(id, { callback, at: now + delay });
			return id;
	};
	env.context.clearTimeout = (id) => timers.delete(id);
	const capture = env.load("capture", {
		"./feed": env.feed,
		"./navigation": env.navigation,
		"./storage": {
			getFeedHistory: async () => ({ items: [] }),
			saveFeedItems: async () =>
				saves.push(env.feed.serializeFeedCards(env.feed.getLiveFeedCards())),
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

test("refresh keeps restored history visible until the complete replacement is ready", () => {
	const env = captureFixture();
	const live = env.feed.getLiveFeedCards()[0];
	env.navigation.replaceFeeds({
		html: '<div class="feed-card"><a href="/video/restored">Restored</a></div>',
	});
	env.capture.startFeedCapture();
	live.querySelector("a").remove();
	env.advance(1000);
	assert.ok(env.document.querySelector("[data-bili-feed-history-card]"));
	assert.equal(env.saves.length, 0);
	const link = env.document.createElement("a");
	link.setAttribute("href", "/video/new");
	live.appendChild(link);
	env.advance(1000);
	assert.equal(
		env.document.querySelector("[data-bili-feed-history-card]"),
		null,
	);
	assert.equal(env.saves.length, 1);
	assert.match(env.saves[0], /\/video\/new/);
});

test("capture waits for native links even when history covers loading cards", () => {
	const env = captureFixture();
	const live = env.feed.getLiveFeedCards()[0];
	env.capture.startFeedCapture();
	live.innerHTML = "";
	env.navigation.replaceFeeds({
		html: '<div class="feed-card"><a href="/video/old">Old</a></div>',
	});
	env.advance(1000);
	assert.equal(env.saves.length, 0);
	assert.equal(env.feed.feedIdentity(env.feed.getLiveFeedCards()), "");
	const link = env.document.createElement("a");
	link.setAttribute("href", "/video/new");
	live.appendChild(link);
	env.advance(1000);
	assert.equal(env.saves.length, 1);
	assert.match(env.saves[0], /\/video\/new/);
	assert.doesNotMatch(env.saves[0], /\/video\/old/);
});

test("refresh completion preserves selected history and forward reaches the new feed at capacity", async () => {
	const env = fixture();
	let value = { items: [], currentIndex: -1 };
	env.context.storage = {
		defineItem: () => ({
			getValue: async () => structuredClone(value),
			setValue: async (next) => {
				value = structuredClone(next);
			},
		}),
	};
	const storage = env.load("storage", { "./feed": env.feed });
	const navigation = env.load("navigation", {
		"./feed": env.feed,
		"./storage": storage,
	});
	const live = env.feed.getLiveFeedCards()[0];
	for (let i = 0; i < 10; i++) {
		live.innerHTML = `<a href="/video/feed${i}">Feed ${i}</a>`;
		await storage.saveFeedItems();
	}
	const selected = await storage.navigateToIndex(0);
	navigation.replaceFeeds(selected);
	await storage.saveFeedItems();
	assert.equal(
		value.currentIndex,
		0,
		"duplicate baseline cannot move selected history",
	);
	const nativeLink = live.querySelector("a");
	nativeLink.setAttribute("href", "/video/new");
	await storage.saveFeedItems();
	assert.equal(value.items.length, 10);
	assert.equal(value.items[value.currentIndex].id, selected.id);
	assert.equal(
		env.document
			.querySelector("[data-bili-feed-history-card] a")
			.getAttribute("href"),
		"/video/feed0",
	);
	assert.match((await storage.navigateToRelative(1)).html, /\/video\/feed2/);
	await storage.navigateToIndex(8);
	const latest = await storage.navigateToRelative(1);
	assert.match(latest.html, /\/video\/new/);
	navigation.replaceFeeds(latest);
	assert.equal(
		env.document
			.querySelector("[data-bili-feed-history-card] a")
			.getAttribute("href"),
		"/video/new",
	);
});

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

test("slow Bilibili refreshes are still captured after ten seconds", async () => {
	const env = captureFixture();
	env.capture.startFeedCapture();
	env.advance(10500);
	assert.equal(env.saves.length, 0);
	env.document.querySelector(".feed-card a").setAttribute("href", "/video/slow");
	env.advance(1000);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(env.saves.length, 1);
	assert.match(env.saves[0], /\/video\/slow/);
});

test("refresh click does not save the unstable pre-refresh DOM", () => {
	const env = fixture();
	const refreshButton = env.document.createElement("button");
	refreshButton.className = "primary-btn roll-btn";
	refreshButton.textContent = "换一换";
	env.document.body.appendChild(refreshButton);
	let baselineSaves = 0;
	let starts = 0;
	let stops = 0;
	let exits = 0;
	env.context.storage = { watch: () => () => {} };
	const ui = env.load("controls", {
		"./feed": env.feed,
		"./capture": {
			startFeedCapture: () => {
				starts += 1;
			},
			stopFeedCapture: () => {
				stops += 1;
			},
		},
		"./navigation": {
			navigateToPreviousFeed: async () => {},
			navigateToNextFeed: async () => {},
			updateButtonStates: () => {},
			exitHistoryView: () => {
				exits += 1;
			},
		},
		"./storage": {
			saveFeedItems: () => {
				baselineSaves += 1;
				return Promise.resolve();
			},
		},
		"./debug": { addDebugButton: () => {}, trace: () => {}, traceHtml: () => {} },
	});
	const cleanup = ui.setupUI();
	refreshButton.dispatchEvent(new env.context.Event("click", { bubbles: true }));
	assert.equal(starts, 2, "startup capture plus one refresh capture");
	assert.equal(stops, 1);
	assert.equal(exits, 1, "refresh exposes Bilibili's live loading state");
	assert.equal(baselineSaves, 0);
	assert.equal(refreshButton.style.cursor, "pointer");
	cleanup();
});

test("diagnostic logs survive new page sessions, stay bounded and production is silent", async () => {
	const stored = { biliFeedHistory: { items: ["preserve"] } };
	const writes = [];
	function start(enabled) {
		const env = fixture();
		Object.assign(env.context, {
			testEnv: { DEV: enabled, MODE: "production" },
			performance: { getEntriesByType: () => [] },
			console,
			browser: {
				storage: {
					local: {
						get: async () => structuredClone(stored),
						set: async (value) => {
							writes.push(value);
							Object.assign(stored, structuredClone(value));
						},
						remove: async (keys) => {
							for (const key of keys) delete stored[key];
						},
					},
				},
			},
		});
		return env.load("debug", { "./feed": env.feed });
	}
	const first = start(true);
	for (let i = 0; i < 305; i++) first.trace("capture", { i });
	for (let i = 0; i < 8; i++) first.traceHtml(`capture-${i}`);
	await new Promise((resolve) => setImmediate(resolve));
	const htmlKey = Object.keys(stored).find((key) =>
		key.startsWith("biliFeedHtml:"),
	);
	assert.equal(stored[htmlKey].length, 6);
	assert.equal(stored[htmlKey][0].reason, "capture-2");
	assert.match(stored[htmlKey][0].html, /feed-card/);
	assert.equal(stored[htmlKey][0].roots.length, 1);
	const oldKey = Object.keys(stored).find((key) =>
		key.startsWith("biliFeedDebug:"),
	);
	assert.equal(stored[oldKey].length, 300);
	start(true).trace("restart", {});
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(
		Object.keys(stored).filter((key) => key.startsWith("biliFeedDebug:"))
			.length,
		2,
	);
	assert.equal(stored[oldKey].at(-1).data.i, 304);
	const before = writes.length;
	const production = start(false);
	production.trace("must-not-save", {});
	production.traceHtml("must-not-save-html");
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(writes.length, before);
	assert.deepEqual(stored.biliFeedHistory, { items: ["preserve"] });
});

test("a late initial feed is saved and ongoing card changes restart settling", async () => {
	const env = captureFixture();
	const container = env.document.querySelector(".container");
	env.feed.getLiveFeedCards().forEach((card) => {
		card.remove();
	});
	env.capture.startFeedCapture(true);
	env.advance(6000);
	assert.equal(env.saves.length, 0);
	container.innerHTML = '<div class="feed-card"><a href="/video/a">A</a></div>';
	env.advance(500);
	container.querySelector("a").setAttribute("href", "/video/b");
	env.advance(500);
	assert.equal(env.saves.length, 0);
	env.advance(250);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(env.saves.length, 1);
	assert.match(env.saves[0], /\/video\/b/);
});

test("empty loading state is not saved and cleanup cancels pending capture", () => {
	const env = captureFixture();
	env.capture.startFeedCapture();
	env.feed.getLiveFeedCards().forEach((card) => {
		card.innerHTML = "";
	});
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
	env.advance(31000);
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
	let value = {
		extensionVersion: "1.0.2",
		items: [
			{
				id: "existing",
				html: '<div class="feed-card"><a href="/video/existing">Existing</a></div>',
				timestamp: 1,
			},
		],
		currentIndex: 0,
	};
	env.context.storage = {
		defineItem: () => ({
			getValue: async () => structuredClone(value),
			setValue: async (next) => {
				value = structuredClone(next);
			},
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
	navigation.replaceFeeds({
		html: '<div class="feed-card">History one</div><div class="feed-card">History two</div>',
	});
	assert.deepEqual([...container.children], children);
	assert.equal(container.innerHTML, originalMarkup);
	assert.equal(originals[0].hasAttribute("data-bili-feed-history-host"), false);
	assert.equal(originals[0].querySelector("a").textContent, "Live one");
	assert.equal(
		container.querySelectorAll(".feed-card")[1].style.display,
		"none",
	);
	assert.equal(feed.getLiveFeedCards().length, 1);
	assert.equal(
		document.querySelectorAll("[data-bili-feed-history-card]").length,
		1,
	);
	assert.equal(
		document
			.querySelector("[data-bili-feed-history-card]")
			.closest(".container"),
		null,
	);
	assert.equal(
		document.querySelector("[data-bili-feed-history-card]").style
			.backgroundColor,
		"Canvas",
	);
	navigation.exitHistoryView();
	assert.equal(container.innerHTML, originalMarkup);
	assert.equal(document.head.children.length, 0);
});

test("alternating visible batches exclude the hidden restored feed", () => {
	const { document, feed } = fixture();
	const cards = [...document.querySelectorAll(".feed-card")];
	assert.match(feed.feedIdentity(feed.getLiveFeedCards()), /live1/);
	cards[0].style.display = "none";
	cards[1].style.display = "";
	assert.match(feed.feedIdentity(feed.getLiveFeedCards()), /live2/);
	assert.doesNotMatch(
		feed.serializeFeedCards(feed.getLiveFeedCards()),
		/live1/,
	);
	document.querySelector(".container").style.display = "none";
	assert.equal(feed.getLiveFeedCards().length, 0);
});

test("logged-out Bilibili login cards have a stable feed identity", () => {
	const { document, feed } = fixture();
	const loginCard = document.createElement("div");
	loginCard.className = "feed-card";
	loginCard.innerHTML =
		'<div class="bili-login-card">解锁更多感兴趣的内容立即登录</div>';
	document.querySelector(".container").prepend(loginCard);

	const identity = feed.feedIdentity(feed.getLiveFeedCards());
	assert.match(identity, /www\.bilibili\.com\/guest-login-card/);
	assert.match(identity, /www\.bilibili\.com\/video\/live1/);
});

test("extension version changes clear ephemeral history for existing users", async () => {
	const env = fixture();
	let value = {
		extensionVersion: "1.0.0",
		items: [
			{
				id: "old",
				html: '<div class="feed-card"><a href="/video/old">Old</a></div>',
				timestamp: 1,
			},
		],
		currentIndex: 0,
	};
	env.context.storage = {
		defineItem: () => ({
			getValue: async () => structuredClone(value),
			setValue: async (next) => {
				value = structuredClone(next);
			},
		}),
	};
	const storage = env.load("storage", { "./feed": env.feed });
	await storage.setupStorage();
	assert.deepEqual(value, {
		extensionVersion: "1.0.2",
		items: [],
		currentIndex: -1,
	});
});

test("unpacked reload clears feed history but a Chrome update does not", async () => {
	let onInstalled;
	const removed = [];
	const source = readFileSync(
		`${__dirname}/../entrypoints/background.ts`,
		"utf8",
	);
	const output = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const context = vm.createContext({
		browser: {
			runtime: {
				onInstalled: {
					addListener: (listener) => {
						onInstalled = listener;
					},
				},
			},
		},
		defineBackground: (setup) => setup(),
		exports: {},
		storage: {
			removeItem: async (key) => removed.push(key),
		},
	});
	vm.runInContext(output, context);
	onInstalled({ reason: "update" });
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(removed, ["local:biliFeedHistory"]);
	onInstalled({ reason: "chrome_update" });
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(removed, ["local:biliFeedHistory"]);
});

test("captured feeds remain available in order after back and forward", async () => {
	const env = captureFixture();
	let value = {
		extensionVersion: "1.0.2",
		items: [],
		currentIndex: -1,
	};
	env.context.storage = {
		defineItem: () => ({
			getValue: async () => structuredClone(value),
			setValue: async (next) => {
				value = structuredClone(next);
			},
		}),
	};
	const storage = env.load("storage", { "./feed": env.feed });
	const navigation = env.load("navigation", {
		"./feed": env.feed,
		"./storage": storage,
	});
	const capture = env.load("capture", {
		"./feed": env.feed,
		"./navigation": navigation,
		"./storage": storage,
	});
	await storage.setupStorage();
	await storage.saveFeedItems();
	capture.startFeedCapture();
	env.document.querySelector(".feed-card a").setAttribute("href", "/video/B");
	env.advance(1000);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(value.items.length, 2);
	assert.match(value.items[1].html, /\/video\/B/);
	await navigation.navigateToPreviousFeed();
	assert.match(
		env.document.querySelector("[data-bili-feed-history-card] a").href,
		/\/video\/live1/,
	);
	await navigation.navigateToNextFeed();
	assert.match(
		env.document.querySelector("[data-bili-feed-history-card] a").href,
		/\/video\/B/,
	);
});

test("startup recognizes an older unselected feed and ignores cosmetic duplicates", async () => {
	const env = fixture();
	let value = { items: [], currentIndex: -1 };
	env.context.storage = {
		defineItem: () => ({
			getValue: async () => structuredClone(value),
			setValue: async (next) => {
				value = structuredClone(next);
			},
		}),
	};
	const first = env.load("storage", { "./feed": env.feed });
	await first.setupStorage();
	await first.saveFeedItems();
	env.document.querySelector("a").setAttribute("href", "/video/B");
	await first.saveFeedItems();
	const restarted = env.load("storage", { "./feed": env.feed });
	await restarted.setupStorage();
	env.document.querySelector("a").setAttribute("href", "/video/live1");
	await restarted.saveFeedItems(true);
	assert.equal(value.items.length, 2);
	assert.equal(value.currentIndex, 0);
	assert.match((await restarted.navigateToRelative(1)).html, /\/video\/B/);
	await restarted.navigateToRelative(-1);
	env.document
		.querySelector("a")
		.setAttribute("href", "/video/live1?tracking=changed");
	env.document.querySelector("a").textContent = "Updated count";
	await restarted.saveFeedItems();
	assert.equal(value.items.length, 2);
});

test("arrows skip old incomplete snapshots in both directions without deleting them", async () => {
	const env = fixture();
	let value = {
		items: [
			{
				id: "A",
				html: '<div class="feed-card"><a href="/video/A">A</a></div>',
				timestamp: 1,
			},
			{ id: "broken", html: '<div class="feed-card"></div>', timestamp: 2 },
			{
				id: "B",
				html: '<div class="feed-card"><a href="/video/B">B</a></div>',
				timestamp: 3,
			},
		],
		currentIndex: 2,
	};
	env.context.storage = {
		defineItem: () => ({
			getValue: async () => structuredClone(value),
			setValue: async (next) => {
				value = structuredClone(next);
			},
		}),
	};
	const storage = env.load("storage", { "./feed": env.feed });
	assert.equal((await storage.navigateToRelative(-1)).id, "A");
	assert.equal(value.currentIndex, 0);
	assert.equal((await storage.navigateToRelative(1)).id, "B");
	assert.equal(value.items.length, 3);
});

test("restarting on the selected older feed does not append a duplicate", async () => {
	const env = fixture();
	let value = { items: [], currentIndex: -1 };
	env.context.storage = {
		defineItem: () => ({
			getValue: async () => structuredClone(value),
			setValue: async (next) => {
				value = structuredClone(next);
			},
		}),
	};
	const first = env.load("storage", { "./feed": env.feed });
	await first.setupStorage();
	await first.saveFeedItems();
	env.document.querySelector("a").setAttribute("href", "/video/B");
	await first.saveFeedItems();
	await first.navigateToIndex(0);

	const restarted = env.load("storage", { "./feed": env.feed });
	await restarted.setupStorage();
	env.document.querySelector("a").setAttribute("href", "/video/live1");
	await restarted.saveFeedItems();

	assert.equal(value.items.length, 2);
	assert.equal(value.currentIndex, 0);
	assert.match((await restarted.navigateToRelative(1)).html, /\/video\/B/);
});

test("restart restores newest saved feed instead of Chrome's stale DOM", async () => {
	const env = captureFixture();
	env.context.performance = {
		getEntriesByType: () => [{ type: "back_forward" }],
	};
	const card = (name) =>
		`<div class="feed-card"><a href="/video/${name}">${name}</a></div>`;
	let value = {
		extensionVersion: "1.0.2",
		items: [
			{ id: "A", html: card("A"), timestamp: 3 },
			{ id: "B", html: card("B"), timestamp: 4 },
		],
		currentIndex: 0,
	};
	env.context.storage = {
		defineItem: () => ({
			getValue: async () => structuredClone(value),
			setValue: async (next) => {
				value = structuredClone(next);
			},
		}),
	};
	const storage = env.load("storage", { "./feed": env.feed });
	const navigation = env.load("navigation", {
		"./feed": env.feed,
		"./storage": storage,
	});
	const capture = env.load("capture", {
		"./feed": env.feed,
		"./storage": storage,
		"./navigation": navigation,
	});
	await storage.setupStorage();
	assert.deepEqual(
		value.items.map((item) => item.id),
		["A", "B"],
	);
	env.feed.getLiveFeedCards()[0].innerHTML = '<a href="/video/A">A</a>';
	capture.startFeedCapture(true);
	env.advance(1000);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(value.currentIndex, 1);
	assert.equal(value.items.length, 2);
	assert.equal(
		env.document.querySelector("[data-bili-feed-history-card] a").textContent,
		"B",
	);
	await navigation.navigateToPreviousFeed();
	assert.equal(
		env.document.querySelector("[data-bili-feed-history-card] a").textContent,
		"A",
	);
	await navigation.navigateToNextFeed();
	assert.equal(
		env.document.querySelector("[data-bili-feed-history-card] a").textContent,
		"B",
	);
});

test("a page reload saves the current feed instead of restoring old history", async () => {
	const env = captureFixture();
	env.context.performance = {
		getEntriesByType: () => [{ type: "reload" }],
	};
	let restores = 0;
	const saves = [];
	const capture = env.load("capture", {
		"./feed": env.feed,
		"./navigation": {
			exitHistoryView: () => {},
			getViewRevision: () => 0,
			restoreLatestFeed: async () => {
				restores += 1;
			},
		},
		"./storage": {
			getFeedHistory: async () => ({
				items: [{ id: "old", html: "old", timestamp: 1 }],
			}),
			saveFeedItems: async (initial) => {
				saves.push({ initial, html: env.feed.serializeFeedCards(env.feed.getLiveFeedCards()) });
			},
		},
	});

	capture.startFeedCapture(true);
	env.advance(1000);
	await new Promise((resolve) => setImmediate(resolve));

	assert.equal(restores, 0);
	assert.equal(saves.length, 1);
	assert.equal(saves[0].initial, true);
});

test("a new page navigation saves the current feed instead of restoring old history", async () => {
	const env = captureFixture();
	env.context.performance = {
		getEntriesByType: () => [{ type: "navigate" }],
	};
	let restores = 0;
	const saves = [];
	const capture = env.load("capture", {
		"./feed": env.feed,
		"./navigation": {
			exitHistoryView: () => {},
			getViewRevision: () => 0,
			restoreLatestFeed: async () => {
				restores += 1;
			},
		},
		"./storage": {
			getFeedHistory: async () => ({
				items: [{ id: "old", html: "old", timestamp: 1 }],
			}),
			saveFeedItems: async (initial) => {
				saves.push({
					initial,
					html: env.feed.serializeFeedCards(env.feed.getLiveFeedCards()),
				});
			},
		},
	});

	capture.startFeedCapture(true);
	env.advance(1000);
	await new Promise((resolve) => setImmediate(resolve));

	assert.equal(restores, 0);
	assert.equal(saves.length, 1);
	assert.equal(saves[0].initial, true);
});

test("saving during history view excludes overlays, carousel, and live-stream tiles", () => {
	const { feed, navigation } = fixture();
	const before = feed.serializeFeedCards(feed.getLiveFeedCards());
	navigation.replaceFeeds({
		html: '<div class="feed-card">Historical video</div>',
	});
	const after = feed.serializeFeedCards(feed.getLiveFeedCards());
	assert.equal(after, before);
	assert.doesNotMatch(
		after,
		/carousel|Live stream|Historical video|data-bili-feed-history/,
	);
});

test("old whole-container snapshots display only cards and repeated navigation cleans up", () => {
	const { document, navigation } = fixture();
	const item = {
		format: "feed-container",
		html: '<div class="recommended-swipe">Old carousel</div><div class="feed-card">Old card</div><div class="floor-single-card">Old stream</div>',
	};
	for (let i = 0; i < 5; i++) navigation.replaceFeeds(item);
	assert.equal(document.querySelectorAll(".recommended-swipe").length, 1);
	assert.equal(
		document.querySelectorAll("[data-bili-feed-history-card]").length,
		1,
	);
	assert.equal(document.head.children.length, 0);
	assert.doesNotMatch(document.body.textContent, /Old carousel|Old stream/);
	navigation.exitHistoryView();
	assert.equal(
		document.querySelectorAll("[data-bili-feed-history-card]").length,
		0,
	);
});
