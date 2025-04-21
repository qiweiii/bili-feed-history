import { getFeedHistory, navigateToIndex } from "./storage";
import { updateButtonStates } from "./ui";
import { FeedHistoryItem } from "./types";

// Navigate to previous feed items
export async function navigateToPreviousFeed(): Promise<void> {
  const history = await getFeedHistory();
  if (history.currentIndex <= 0) return;

  const historyItem = await navigateToIndex(history.currentIndex - 1);
  if (historyItem) {
    displayFeed(historyItem);
    updateButtonStates();
  }
}

// Navigate to next feed items
export async function navigateToNextFeed(): Promise<void> {
  const history = await getFeedHistory();
  if (history.currentIndex >= history.items.length - 1) return;

  const historyItem = await navigateToIndex(history.currentIndex + 1);
  if (historyItem) {
    displayFeed(historyItem);
    updateButtonStates();
  }
}

// Display feed items from history
export function displayFeed(historyItem: FeedHistoryItem): void {
  // Find the container for feed cards
  const feedCardsContainer =
    document.querySelector(".feed-card")?.parentElement;
  if (!feedCardsContainer) {
    console.error("Could not find feed cards container");
    return;
  }

  // Create a temporary element to parse HTML
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = historyItem.html;

  // Clear existing feed cards
  const existingCards = feedCardsContainer.querySelectorAll(".feed-card");
  existingCards.forEach((card) => card.remove());

  // Add the history feed cards to the container
  Array.from(tempContainer.children).forEach((child) => {
    feedCardsContainer.appendChild(child);
  });
}
