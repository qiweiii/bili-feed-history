/**
 * Represents a single feed history item
 */
export interface FeedHistoryItem {
  /** Unique ID for the history item */
  id: string;
  /** HTML content of recommendation cards only */
  html: string;
  /** Identifies snapshots that contain the complete recommendation container */
  format?: "feed-container";
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
