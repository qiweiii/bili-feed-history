import { getFeedCards, isHomeFeedPage } from "./bilibili";
import { getFeedHistory, navigateToIndex, navigateToRelative } from "./storage";
import {
  feedIdentity,
  getLiveFeedCards,
  historyCardAttribute,
  historyHostAttribute,
  isDisplayed,
} from "./feed";
import type { FeedHistoryItem } from "./types";
import { trace, traceHtml } from "./debug";

const historyCardPairs: { live: HTMLElement; overlay: HTMLElement }[] = [];
let historyLayer: HTMLElement | null = null;
let viewRevision = 0;

export function getViewRevision(): number {
  return viewRevision;
}

export async function restoreLatestFeed(revision: number): Promise<void> {
  const history = await getFeedHistory();
  if (revision !== viewRevision || !isHomeFeedPage()) return;
  const item = await navigateToIndex(history.items.length - 1);
  if (item && revision === viewRevision && isHomeFeedPage()) {
    replaceFeeds(item);
    trace("history.restoreLatest", { id: item.id });
    void updateButtonStates();
  }
}

export async function navigateToPreviousFeed(): Promise<void> {
  await navigateHistory(-1);
}

export async function navigateToNextFeed(): Promise<void> {
  await navigateHistory(1);
}

async function navigateHistory(offset: number): Promise<void> {
  const revision = ++viewRevision;
  const item = await navigateToRelative(offset);
  if (item && revision === viewRevision && isHomeFeedPage()) {
    replaceFeeds(item);
    void updateButtonStates();
  }
}

// Render above the native grid without adding children to Bilibili-owned nodes.
export function replaceFeeds(historyItem: FeedHistoryItem): void {
  exitHistoryView();
  const snapshotRoot = document.createElement("div");
  snapshotRoot.innerHTML = historyItem.html;
  // Ignore non-card content in snapshots made by the previous local fix.
  const snapshotCards = getFeedCards(snapshotRoot).filter(isDisplayed);
  const liveCards = getLiveFeedCards();
  trace("history.render", {
    id: historyItem.id,
    saved: feedIdentity(snapshotCards),
    live: feedIdentity(liveCards),
    savedCount: snapshotCards.length,
    liveCount: liveCards.length,
  });

  historyLayer = document.createElement("div");
  historyLayer.setAttribute(historyHostAttribute, "");
  historyLayer.style.position = "absolute";
  historyLayer.style.inset = "0";
  historyLayer.style.width = "0";
  historyLayer.style.height = "0";
  historyLayer.style.zIndex = "100";
  historyLayer.style.pointerEvents = "none";

  liveCards.forEach((live, index) => {
    const overlay = snapshotCards[index];
    if (!overlay) return;
    overlay.setAttribute(historyCardAttribute, "");
    overlay.style.position = "absolute";
    overlay.style.margin = "0";
    overlay.style.display = "block";
    overlay.style.visibility = "visible";
    overlay.style.setProperty("background-color", "Canvas", "important");
    overlay.style.overflow = "hidden";
    overlay.style.pointerEvents = "auto";
    historyLayer?.appendChild(overlay);
    historyCardPairs.push({ live, overlay });
  });
  document.body.appendChild(historyLayer);
  syncHistoryCardPositions();
  window.addEventListener("resize", syncHistoryCardPositions);
  traceHtml("history.rendered");
}

function syncHistoryCardPositions(): void {
  historyCardPairs.forEach(({ live, overlay }) => {
    const rect = live.getBoundingClientRect();
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  });
}

export function exitHistoryView(): void {
  ++viewRevision;
  window.removeEventListener("resize", syncHistoryCardPositions);
  historyCardPairs.splice(0);
  historyLayer?.remove();
  historyLayer = null;
}

// Update navigation button states
export async function updateButtonStates(): Promise<void> {
  const history = await getFeedHistory();
  const prevButton = document.getElementById(
    "bili-feed-prev",
  ) as HTMLButtonElement;
  const nextButton = document.getElementById(
    "bili-feed-next",
  ) as HTMLButtonElement;
  if (!prevButton || !nextButton) return;

  prevButton.disabled = history.currentIndex <= 0;
  prevButton.style.opacity = prevButton.disabled ? "0.5" : "1";
  nextButton.disabled = history.currentIndex >= history.items.length - 1;
  nextButton.style.opacity = nextButton.disabled ? "0.5" : "1";
}
