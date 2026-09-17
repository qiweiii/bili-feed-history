import { getLiveFeedCards } from "./feed";
import { saveFeedItems } from "./storage";

const captureTimeoutMs = 10000;
let timer: number | undefined;
let baseline = "";
let candidate = "";
let candidateSince = 0;
let deadline = 0;
let expectedCount = 0;

function readFeed(): { signature: string; count: number } {
  const cards = getLiveFeedCards();
  const identities = cards.map((card) => {
    const link = card.querySelector<HTMLAnchorElement>('a[href*="/video/"]') ??
      card.querySelector<HTMLAnchorElement>("a[href]");
    if (link) {
      const href = link.getAttribute("href");
      if (href) {
        try {
          const url = new URL(href, location.href);
          return url.host + url.pathname;
        } catch {
          return href;
        }
      }
    }
    return card.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "";
  });
  return {
    signature: identities.length && identities.every(Boolean)
      ? identities.join("\u001f") : "",
    count: cards.length,
  };
}

export function startFeedCapture(initial = false): void {
  if (location.pathname !== "/") return;
  // Repeated clicks extend the pending request without forgetting its baseline.
  if (timer !== undefined) {
    deadline = Date.now() + captureTimeoutMs;
    return;
  }
  const feed = readFeed();
  baseline = initial ? "" : feed.signature;
  expectedCount = feed.count;
  candidate = "";
  deadline = Date.now() + captureTimeoutMs;
  timer = window.setTimeout(poll, 250);
}

function poll(): void {
  timer = undefined;
  if (location.pathname !== "/" || Date.now() >= deadline) {
    stopFeedCapture();
    return;
  }
  const feed = readFeed();
  if (!feed.signature || feed.signature === baseline || feed.count < expectedCount) {
    candidate = "";
  } else if (feed.signature !== candidate) {
    candidate = feed.signature;
    candidateSince = Date.now();
  } else if (Date.now() - candidateSince >= 500) {
    stopFeedCapture();
    void saveFeedItems().catch((error) => {
      console.error("Could not save Bilibili feed history", error);
    });
    return;
  }
  timer = window.setTimeout(poll, 250);
}

export function stopFeedCapture(): void {
  clearTimeout(timer);
  timer = undefined;
  candidate = "";
}
