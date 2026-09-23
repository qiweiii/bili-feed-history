import { getFeedCards, isHomeFeedPage } from "./bilibili";
import { feedIdentity, getLiveFeedCards, historyHostAttribute } from "./feed";
import { getFeedHistory, saveFeedItems } from "./storage";
import {
  exitHistoryView,
  getViewRevision,
  restoreLatestFeed,
} from "./navigation";
import { trace, traceHtml } from "./debug";

const captureTimeoutMs = 30000;
const pollIntervalMs = 250;
// A feed identity must stay stable this long before it counts as the new feed.
const settleMs = 500;

let pollTimer: number | undefined;
let baseline = "";
let candidate = "";
let candidateSince = 0;
let deadline = 0;
let expectedCount = 0;
let initialCapture = false;
let viewRevision = 0;
let restoreLatest = false;
let pendingRefreshes = 0;

function getStartupCaptureMode(): {
  navigationType: string;
  restoreLatest: boolean;
} {
  if (typeof performance === "undefined") {
    return { navigationType: "unknown", restoreLatest: false };
  }

  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const navigationType = navigation?.type ?? "unknown";
  return {
    navigationType,
    // Chrome uses back_forward when it restores the previous session's tab.
    restoreLatest: navigationType === "back_forward",
  };
}

function readFeed(): { signature: string; count: number; total: number } {
  const cards = getLiveFeedCards();
  return {
    signature: feedIdentity(cards),
    count: cards.length,
    total: getFeedCards().length,
  };
}

// The click listener runs before Bilibili replaces the currently visible feed.
// Save it now, since a rapid second click can replace it before polling settles.
export function captureBeforeRefresh(): void {
  if (!isHomeFeedPage()) return;
  const wasInitial = pollTimer !== undefined && initialCapture;
  if (wasInitial) stopFeedCapture();

  const feed = readFeed();
  const historyVisible =
    document.querySelector(`[${historyHostAttribute}]`) !== null;
  const complete =
    feed.signature !== "" &&
    (pollTimer === undefined || feed.count >= expectedCount);
  const save =
    complete &&
    !(wasInitial && restoreLatest) &&
    (!historyVisible || (pollTimer !== undefined && feed.signature !== baseline));
  if (save) {
    void saveFeedItems().catch((error) => {
      console.error("Could not save Bilibili feed history", error);
    });
  }

  if (pollTimer !== undefined) {
    if (complete && feed.signature !== baseline) {
      baseline = feed.signature;
      expectedCount = feed.count;
      candidate = "";
      pendingRefreshes = Math.max(0, pendingRefreshes - 1);
    }
    ++pendingRefreshes;
  }
  trace("capture.beforeRefresh", {
    ...feed,
    queued: save,
    pendingRefreshes,
  });
}

export function startFeedCapture(initial = false): void {
  if (!isHomeFeedPage()) return;
  if (!initial && initialCapture && pollTimer !== undefined) stopFeedCapture();
  const startupMode = initial
    ? getStartupCaptureMode()
    : { navigationType: "not-startup", restoreLatest: false };
  trace("capture.start", {
    initial,
    pending: pollTimer !== undefined,
    navigationType: startupMode.navigationType,
    restoreLatest: startupMode.restoreLatest,
    ...readFeed(),
  });
  // Repeated clicks extend the pending request without forgetting its baseline.
  if (pollTimer !== undefined) {
    deadline = Date.now() + captureTimeoutMs;
    viewRevision = getViewRevision();
    return;
  }
  const feed = readFeed();
  initialCapture = initial;
  restoreLatest = startupMode.restoreLatest;
  viewRevision = getViewRevision();
  baseline = initial ? "" : feed.signature;
  expectedCount = feed.count;
  candidate = "";
  pendingRefreshes = initial ? 0 : 1;
  deadline = Date.now() + captureTimeoutMs;
  pollTimer = window.setTimeout(poll, pollIntervalMs);
}

function poll(): void {
  pollTimer = undefined;
  if (!isHomeFeedPage() || Date.now() >= deadline) {
    const feed = readFeed();
    trace("capture.timeout", {
      ...feed,
      baseline,
      candidate,
      expectedCount,
      pendingRefreshes,
    });
    traceHtml("capture.timeout");
    stopFeedCapture();
    return;
  }
  const feed = readFeed();
  if (
    !feed.signature ||
    feed.signature === baseline ||
    feed.count < expectedCount
  ) {
    candidate = "";
  } else if (feed.signature !== candidate) {
    trace("capture.candidate", feed);
    candidate = feed.signature;
    candidateSince = Date.now();
  } else if (Date.now() - candidateSince >= settleMs) {
    trace("capture.settled", { ...feed, pendingRefreshes });
    traceHtml("capture.settled");
    const initial = initialCapture;
    const revision = viewRevision;
    const restore = restoreLatest;
    baseline = feed.signature;
    expectedCount = feed.count;
    candidate = "";
    if (initial || --pendingRefreshes <= 0) stopFeedCapture();
    void completeCapture(initial, revision, restore).catch((error) => {
      console.error("Could not save Bilibili feed history", error);
    });
    if (!initial && pendingRefreshes > 0) {
      pollTimer = window.setTimeout(poll, pollIntervalMs);
    }
    return;
  }
  pollTimer = window.setTimeout(poll, pollIntervalMs);
}

async function completeCapture(
  initial: boolean,
  revision: number,
  restoreLatest: boolean,
): Promise<void> {
  if (initial && restoreLatest && (await getFeedHistory()).items.length > 0) {
    await restoreLatestFeed(revision);
  } else {
    if (!initial && revision === getViewRevision()) exitHistoryView();
    await saveFeedItems(initial);
  }
}

export function stopFeedCapture(): void {
  clearTimeout(pollTimer);
  pollTimer = undefined;
  candidate = "";
  pendingRefreshes = 0;
}
