import { getFeedCards, isHomeFeedPage } from "./bilibili";
import { feedIdentity, getLiveFeedCards } from "./feed";
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

export function startFeedCapture(initial = false): void {
  if (!isHomeFeedPage()) return;
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
    return;
  }
  const feed = readFeed();
  initialCapture = initial;
  restoreLatest = startupMode.restoreLatest;
  viewRevision = getViewRevision();
  baseline = initial ? "" : feed.signature;
  expectedCount = feed.count;
  candidate = "";
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
    trace("capture.settled", feed);
    traceHtml("capture.settled");
    stopFeedCapture();
    void completeCapture(
      initialCapture,
      viewRevision,
      restoreLatest,
    ).catch((error) => {
      console.error("Could not save Bilibili feed history", error);
    });
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
}
