import { getFeedHistory, navigateToIndex } from "./storage";
import { FeedHistoryItem } from "./types";

// Navigate to previous feed items
export async function navigateToPreviousFeed(): Promise<void> {
  const history = await getFeedHistory();
  if (history.currentIndex <= 0) return;

  const historyItem = await navigateToIndex(history.currentIndex - 1);
  if (historyItem) {
    replaceFeeds(historyItem);
    updateButtonStates();
  }
}

// Navigate to next feed items
export async function navigateToNextFeed(): Promise<void> {
  const history = await getFeedHistory();
  if (history.currentIndex >= history.items.length - 1) return;

  const historyItem = await navigateToIndex(history.currentIndex + 1);
  if (historyItem) {
    replaceFeeds(historyItem);
    updateButtonStates();
  }
}

// Display feed items from history
export function replaceFeeds(historyItem: FeedHistoryItem): void {
  // Find the container for feed cards
  const feedCardsContainer =
    document.querySelector(".feed-card")?.parentElement;
  if (!feedCardsContainer) {
    return;
  }

  // Create a temporary element to parse HTML
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = historyItem.html;

  // Get the existing cards and new cards from history
  const existingCards = feedCardsContainer.querySelectorAll(".feed-card");
  const historyCards = Array.from(tempContainer.querySelectorAll(".feed-card"));

  // Replace existing cards with history cards (assuming same count)
  if (existingCards.length > 0 && historyCards.length > 0) {
    // Simple 1:1 replacement of cards
    for (let i = 0; i < existingCards.length; i++) {
      if (historyCards[i]) {
        feedCardsContainer.replaceChild(historyCards[i], existingCards[i]);
      }
    }
  } else {
    // Fallback to the original method if no cards found

    // Clear existing feed cards
    existingCards.forEach((card) => card.remove());

    // Add the history feed cards to the container
    while (tempContainer.firstChild) {
      feedCardsContainer.appendChild(tempContainer.firstChild);
    }
  }
}

// Update navigation button states
export async function updateButtonStates(): Promise<void> {
  const history = await getFeedHistory();

  const prevButton = document.getElementById(
    "bili-feed-prev"
  ) as HTMLButtonElement;
  const nextButton = document.getElementById(
    "bili-feed-next"
  ) as HTMLButtonElement;

  if (!prevButton || !nextButton) return;

  // Disable prev button if at the beginning
  prevButton.disabled = history.currentIndex <= 0;
  prevButton.style.opacity = prevButton.disabled ? "0.5" : "1";

  // Disable next button if at the end
  nextButton.disabled = history.currentIndex >= history.items.length - 1;
  nextButton.style.opacity = nextButton.disabled ? "0.5" : "1";
}
