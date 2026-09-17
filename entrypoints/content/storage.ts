import type { FeedHistory, FeedHistoryItem } from "./types";
import { getLiveFeedCards, serializeFeedCards } from "./feed";

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

let historyWriteQueue: Promise<void> = Promise.resolve();

function enqueueHistoryWrite<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = historyWriteQueue.catch(() => {}).then(operation);
  historyWriteQueue = queuedOperation.then(
    () => undefined,
    () => undefined
  );
  return queuedOperation;
}

/**
 * Initialize storage
 */
export async function setupStorage(): Promise<void> {
  await feedHistoryStorage.getValue();
}

/**
 * Save current feed items to storage
 */
export function saveFeedItems(): Promise<void> {
  if (location.pathname !== "/") return Promise.resolve();

  const cards = getLiveFeedCards();
  if (cards.length === 0) return Promise.resolve();
  const html = serializeFeedCards(cards);

  return enqueueHistoryWrite(async () => {
    const history = await feedHistoryStorage.getValue();
    const existingIndex = history.items.findIndex((item) => item.html === html);

    // Avoid duplicates when initialization and refresh capture overlap.
    if (existingIndex >= 0) {
      if (history.currentIndex === existingIndex) return;

      await feedHistoryStorage.setValue({
        ...history,
        currentIndex: existingIndex,
      });
      return;
    }

    const timestamp = Date.now();
    const historyItem: FeedHistoryItem = {
      id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
      html,
      timestamp,
    };
    const newItems = [...history.items, historyItem];
    const limitedItems = newItems.slice(-10);

    await feedHistoryStorage.setValue({
      items: limitedItems,
      currentIndex: limitedItems.length - 1,
    });
  });
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
  return enqueueHistoryWrite(async () => {
    const history = await feedHistoryStorage.getValue();

    if (index < 0 || index >= history.items.length) {
      return null;
    }

    await feedHistoryStorage.setValue({
      ...history,
      currentIndex: index,
    });

    return history.items[index];
  });
}

/**
 * Move relative to the latest stored index in the same serialized write queue.
 */
export function navigateToRelative(
  offset: number
): Promise<FeedHistoryItem | null> {
  return enqueueHistoryWrite(async () => {
    const history = await feedHistoryStorage.getValue();
    const index = history.currentIndex + offset;

    if (index < 0 || index >= history.items.length) {
      return null;
    }

    await feedHistoryStorage.setValue({
      ...history,
      currentIndex: index,
    });

    return history.items[index];
  });
}
