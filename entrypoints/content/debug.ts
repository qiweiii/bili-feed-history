import { getFeedCards } from "./bilibili";
import { historyCardAttribute, historyHostAttribute } from "./feed";

const enabled = import.meta.env.DEV || import.meta.env.MODE === "diagnostic";
const diagnosticRevision = "navigate-feed-13";
const prefix = "biliFeedDebug:";
const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const events: object[] = [];
let pending = Promise.resolve();
const htmlSnapshots: object[] = [];
const htmlPrefix = "biliFeedHtml:";

export function traceHtml(reason: string): void {
  if (!enabled) return;
  const cards = getFeedCards();
  const roots = [
    ...new Set(cards.map((card) => card.parentElement).filter(Boolean)),
  ];
  const rootSnapshots = roots.map((root) => {
    const html = root?.outerHTML ?? "";
    return {
      kind: root?.hasAttribute(historyHostAttribute)
        ? "history-layer"
        : "native",
      html: html.slice(0, 120000),
      truncated: html.length > 120000,
    };
  });
  const html = rootSnapshots.map((root) => root.html).join("\n");
  htmlSnapshots.push({
    time: new Date().toISOString(),
    reason,
    html: html.slice(0, 120000),
    truncated: html.length > 120000,
    roots: rootSnapshots,
    cards: cards.map((card) => ({
      className: card.className,
      display: getComputedStyle(card).display,
      visibility: getComputedStyle(card).visibility,
      text: (card.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
      links: Array.from(card.querySelectorAll("a[href]")).map((link) =>
        link.getAttribute("href"),
      ),
      history: card.hasAttribute(historyCardAttribute),
    })),
  });
  if (htmlSnapshots.length > 6) htmlSnapshots.shift();
  const snapshot = [...htmlSnapshots];
  pending = pending
    .then(() => browser.storage.local.set({ [htmlPrefix + session]: snapshot }))
    .catch((error) => console.warn("Feed HTML diagnostic failed", error));
}

export function trace(event: string, data: object): void {
  if (!enabled) return;
  events.push({ time: new Date().toISOString(), event, data });
  if (events.length > 300) events.shift();
  const snapshot = [...events];
  pending = pending
    .then(() => browser.storage.local.set({ [prefix + session]: snapshot }))
    .catch((error) => console.warn("Feed diagnostic log failed", error));
}

export function addDebugButton(container: HTMLElement): void {
  if (!enabled) return;
  const button = document.createElement("button");
  button.textContent = "Export logs";
  button.title =
    "Download local diagnostic events, including previous browser sessions";
  button.style.width = "48px";
  button.style.padding = "4px 2px";
  button.style.fontSize = "11px";
  button.style.lineHeight = "1.2";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.addEventListener("click", () => {
    void exportLogs().catch((error) =>
      console.error("Feed log export failed", error),
    );
  });
  container.appendChild(button);
}

async function exportLogs(): Promise<void> {
  traceHtml("export");
  await pending;
  const stored = await browser.storage.local.get(null);
  const sessions = Object.fromEntries(
    Object.entries(stored).filter(([key]) => key.startsWith(prefix)),
  );
  const report = {
    diagnosticRevision,
    version: browser.runtime.getManifest().version,
    userAgent: navigator.userAgent,
    sessions,
    htmlSnapshots: Object.fromEntries(
      Object.entries(stored).filter(([key]) => key.startsWith(htmlPrefix)),
    ),
    feedHistory: stored.biliFeedHistory,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `bili-feed-debug-${Date.now()}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

if (enabled) {
  // Keep ten recent page sessions; each session has its own key so tabs cannot
  // overwrite one another's logs. Never touch the user's feed-history key.
  pending = browser.storage.local
    .get(null)
    .then(async (stored) => {
      const keys = Object.keys(stored)
        .filter((key) => key.startsWith(prefix))
        .sort();
      await browser.storage.local.remove(
        keys.slice(0, Math.max(0, keys.length - 9)),
      );
      const htmlKeys = Object.keys(stored)
        .filter((key) => key.startsWith(htmlPrefix))
        .sort();
      await browser.storage.local.remove(
        htmlKeys.slice(0, Math.max(0, htmlKeys.length - 2)),
      );
    })
    .catch((error) => console.warn("Feed log cleanup failed", error));
  trace("page.start", {
    diagnosticRevision,
    navigation: performance
      .getEntriesByType("navigation")
      .map((entry) => (entry as PerformanceNavigationTiming).type),
    visibility: document.visibilityState,
  });
}
