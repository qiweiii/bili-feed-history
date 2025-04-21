import type { FeedHistory, FeedHistoryItem } from "./types";

// Define a storage item with proper namespace
const feedHistoryStorage = storage.defineItem<FeedHistory>(
  "local:biliFeedHistory",
  {
    defaultValue: {
      items: [],
      currentIndex: -1,
    },
  }
);

/**
 * Initialize storage
 */
export async function setupStorage(): Promise<void> {
  await feedHistoryStorage.getValue();
}

/**
 * Save current feed items to storage
 */
export async function saveFeedItems(): Promise<void> {
  const feedCards = document.querySelectorAll(".feed-card");
  console.log(`[saveFeedItems] Found ${feedCards.length} feed cards`);
  if (feedCards.length === 0) return;

  // Create a container element to store the feed HTML
  const container = document.createElement("div");
  feedCards.forEach((card) => {
    container.appendChild(card.cloneNode(true));
  });

  // Generate an ID for this set of feed items
  const id = Date.now().toString();

  // Create history item
  const historyItem: FeedHistoryItem = {
    id,
    html: container.innerHTML,
    timestamp: Date.now(),
  };

  // Get current history
  const history = await feedHistoryStorage.getValue();
  console.log(
    `[saveFeedItems] Current history has ${history.items.length} items, index: ${history.currentIndex}`
  );

  // Simply use existing items array without checking current index
  const newItems = [...history.items];

  // Add new item to history
  newItems.push(historyItem);

  // Limit to 10 items
  const limitedItems =
    newItems.length > 10 ? newItems.slice(newItems.length - 10) : newItems;

  // Update history using proper setValue method
  await feedHistoryStorage.setValue({
    items: limitedItems,
    currentIndex: limitedItems.length - 1,
  });

  console.log(
    `[saveFeedItems] Updated history: ${
      limitedItems.length
    } items, new index: ${limitedItems.length - 1}`
  );
}

/**
 * Get the current feed history
 */
export async function getFeedHistory(): Promise<FeedHistory> {
  return await feedHistoryStorage.getValue();
}

/**
 * Navigate to a specific index
 * @returns The history item at the specified index, or null if index is invalid
 */
export async function navigateToIndex(
  index: number
): Promise<FeedHistoryItem | null> {
  console.log(`[navigateToIndex] Attempting to navigate to index ${index}`);
  const history = await feedHistoryStorage.getValue();
  console.log(
    `[navigateToIndex] Current history has ${history.items.length} items, current index: ${history.currentIndex}`
  );

  if (index < 0 || index >= history.items.length) {
    console.log(`[navigateToIndex] Invalid index ${index} - out of bounds`);
    return null;
  }

  await feedHistoryStorage.setValue({
    ...history,
    currentIndex: index,
  });

  console.log(
    `[navigateToIndex] Successfully navigated to index ${index}, item ID: ${history.items[index].id}`
  );
  return history.items[index];
}
