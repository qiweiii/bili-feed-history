import { isHomeFeedPage } from "./bilibili";
import type { FeedHistory, FeedHistoryItem } from "./types";
import {
	feedIdentity,
	getLiveFeedCards,
	historyHostAttribute,
	snapshotSignature,
	serializeFeedCards,
} from "./feed";
import { trace } from "./debug";

// Namespaced history storage key, shared with the background script (which
// clears it on install/update).
export const feedHistoryStorageKey = "local:biliFeedHistory";

const feedHistoryStorage = storage.defineItem<FeedHistory>(
	feedHistoryStorageKey,
	{
		defaultValue: {
			extensionVersion: browser.runtime.getManifest().version,
			items: [],
			currentIndex: -1,
		},
	},
);

let historyWriteQueue: Promise<void> = Promise.resolve();

function enqueueHistoryWrite<T>(operation: () => Promise<T>): Promise<T> {
	const queuedOperation = historyWriteQueue.catch(() => {}).then(operation);
	historyWriteQueue = queuedOperation.then(
		() => undefined,
		() => undefined,
	);
	return queuedOperation;
}

/**
 * Load history and drop snapshots written by an older extension build, since
 * capture semantics may have changed between versions.
 */
export async function setupStorage(): Promise<void> {
	let history = await feedHistoryStorage.getValue();
	const extensionVersion = browser.runtime.getManifest().version;
	if (history.extensionVersion !== extensionVersion) {
		const previousCount = history.items.length;
		history = {
			extensionVersion,
			items: [],
			currentIndex: -1,
		};
		await feedHistoryStorage.setValue(history);
		trace("storage.resetForUpdate", { previousCount, extensionVersion });
	}
	trace("storage.load", {
		index: history.currentIndex,
		items: history.items.map((item) => item.id),
	});
}

export function saveFeedItems(initial = false): Promise<void> {
	if (!isHomeFeedPage()) return Promise.resolve();

	const cards = getLiveFeedCards();
	if (cards.length === 0) return Promise.resolve();
	const snapshotHtml = serializeFeedCards(cards);
	const feedSignature = feedIdentity(cards);
	if (!feedSignature) return Promise.resolve();

	return enqueueHistoryWrite(async () => {
		const history = await feedHistoryStorage.getValue();
		const historyVisible =
			document.querySelector(`[${historyHostAttribute}]`) !== null;
		const candidateIndexes = [
			history.currentIndex,
			history.items.length - 1,
			...(initial ? history.items.map((_, index) => index).reverse() : []),
		].filter(
			(index, position, indexes) =>
				index >= 0 &&
				index < history.items.length &&
				indexes.indexOf(index) === position,
		);
		const existingIndex =
			candidateIndexes.find((index) => {
				return snapshotSignature(history.items[index].html) === feedSignature;
			}) ?? -1;
		trace("storage.capture", {
			initial,
			browsingHistory: historyVisible,
			identity: feedSignature,
			existingIndex,
			index: history.currentIndex,
			items: history.items.map((item) => item.id),
		});

		// Avoid duplicates when initialization and refresh capture overlap.
		if (existingIndex >= 0) {
			if (historyVisible || history.currentIndex === existingIndex) return;

			await feedHistoryStorage.setValue({
				...history,
				currentIndex: existingIndex,
			});
			return;
		}

		const timestamp = Date.now();
		const historyItem: FeedHistoryItem = {
			id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
			html: snapshotHtml,
			timestamp,
		};
		const allItems = [...history.items, historyItem];
		const retainedItems = allItems.slice(-10);
		const selectedItem = history.items[history.currentIndex];
		// A completed background refresh must not move the history being viewed.
		// Retain that snapshot even when adding a feed reaches the history limit.
		if (
			historyVisible &&
			selectedItem &&
			!retainedItems.includes(selectedItem)
		) {
			retainedItems[0] = selectedItem;
		}

		await feedHistoryStorage.setValue({
			...history,
			items: retainedItems,
			currentIndex:
				historyVisible && selectedItem
					? retainedItems.indexOf(selectedItem)
					: retainedItems.length - 1,
		});
	});
}

export async function getFeedHistory(): Promise<FeedHistory> {
	return await feedHistoryStorage.getValue();
}

/**
 * Navigate to a specific index
 * @returns The history item at the specified index, or null if index is invalid
 */
export async function navigateToIndex(
	index: number,
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
	offset: number,
): Promise<FeedHistoryItem | null> {
	return enqueueHistoryWrite(async () => {
		const history = await feedHistoryStorage.getValue();
		let index = history.currentIndex + offset;
		// Older diagnostic builds could save loading cards. Keep the data, but
		// never navigate to a snapshot that cannot identify every saved card.
		while (
			offset !== 0 &&
			index >= 0 &&
			index < history.items.length &&
			!snapshotSignature(history.items[index].html)
		) {
			trace("history.skipIncomplete", { id: history.items[index].id, index });
			index += Math.sign(offset);
		}
		trace("history.navigate", {
			offset,
			from: history.currentIndex,
			to: index,
			items: history.items.map((item) => item.id),
		});

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
