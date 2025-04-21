/**
 * Represents a single feed history item
 */
export interface FeedHistoryItem {
  /** Unique ID for the history item */
  id: string;
  /** HTML content of feed cards */
  html: string;
  /** Timestamp when this item was saved */
  timestamp: number;
}

/**
 * Represents the complete feed history
 */
export interface FeedHistory {
  /** List of feed history items */
  items: FeedHistoryItem[];
  /** Index of the currently displayed item */
  currentIndex: number;
}
