import { getFeedHistory, navigateToRelative } from "./storage";
import {
  getLiveFeedCards,
  historyCardAttribute,
  historyHostAttribute,
} from "./feed";
import type { FeedHistoryItem } from "./types";

let historyStyle: HTMLStyleElement | null = null;
const historyCards: { live: HTMLElement; overlay: HTMLElement }[] = [];
let viewRevision = 0;

export async function navigateToPreviousFeed(): Promise<void> {
  await navigateHistory(-1);
}

export async function navigateToNextFeed(): Promise<void> {
  await navigateHistory(1);
}

async function navigateHistory(offset: number): Promise<void> {
  const revision = ++viewRevision;
  const item = await navigateToRelative(offset);
  if (item && revision === viewRevision && location.pathname === "/") {
    replaceFeeds(item);
    void updateButtonStates();
  }
}

// Preserve the native grid and carousel; cover only the existing card slots.
export function replaceFeeds(historyItem: FeedHistoryItem): void {
  exitHistoryView();
  const saved = document.createElement("div");
  saved.innerHTML = historyItem.html;
  // Ignore non-card content in snapshots made by the previous local fix.
  const cards = Array.from(saved.querySelectorAll<HTMLElement>(".feed-card"));
  const liveCards = getLiveFeedCards();

  historyStyle = document.createElement("style");
  historyStyle.textContent = `
    .feed-card[${historyHostAttribute}] {
      position: relative !important;
      visibility: hidden !important;
    }
    .feed-card[${historyCardAttribute}] {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      display: block !important;
      visibility: visible !important;
      overflow: hidden;
      z-index: 1;
    }
  `;
  document.head.appendChild(historyStyle);

  liveCards.forEach((live, index) => {
    const overlay = cards[index];
    if (!overlay) return;
    overlay.setAttribute(historyCardAttribute, "");
    live.setAttribute(historyHostAttribute, "");
    live.appendChild(overlay);
    historyCards.push({ live, overlay });
  });
}

export function exitHistoryView(): void {
  ++viewRevision;
  historyCards.splice(0).forEach(({ live, overlay }) => {
    overlay.remove();
    live.removeAttribute(historyHostAttribute);
  });
  historyStyle?.remove();
  historyStyle = null;
}

// Update navigation button states
export async function updateButtonStates(): Promise<void> {
  const history = await getFeedHistory();
  const prevButton = document.getElementById("bili-feed-prev") as HTMLButtonElement;
  const nextButton = document.getElementById("bili-feed-next") as HTMLButtonElement;
  if (!prevButton || !nextButton) return;

  prevButton.disabled = history.currentIndex <= 0;
  prevButton.style.opacity = prevButton.disabled ? "0.5" : "1";
  nextButton.disabled = history.currentIndex >= history.items.length - 1;
  nextButton.style.opacity = nextButton.disabled ? "0.5" : "1";
}
