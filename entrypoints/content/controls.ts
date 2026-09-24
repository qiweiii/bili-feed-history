import {
  captureBeforeRefresh,
  startFeedCapture,
  stopFeedCapture,
} from "./capture";
import {
  navigateToPreviousFeed,
  navigateToNextFeed,
  updateButtonStates,
  exitHistoryView,
} from "./navigation";
import { historyHostAttribute } from "./feed";
import { FeedHistory } from "./types";
import { addDebugButton, trace, traceHtml } from "./debug";
import {
  findRefreshButton,
  isHomeFeedPage,
  isRefreshButton,
} from "./bilibili";

interface ButtonStyleSnapshot {
  backgroundColor: string;
  border: string;
  color: string;
  boxShadow: string;
  width: string;
}

let buttonMountRetryTimer: number | undefined;
let refreshClickHandlerInstalled = false;
let styleSourceButton: HTMLButtonElement | null = null;
let refreshStyleSnapshot: ButtonStyleSnapshot | null = null;

// Wire click handlers, storage watcher and initial capture; returns disposer.
export function setupUI(): () => void {
  installRefreshClickHandler();
  window.addEventListener("resize", updateButtonStyles);

  const unwatch = storage.watch<FeedHistory>(
    "local:biliFeedHistory",
    (history) => {
      trace("storage.changed", {
        index: history?.currentIndex,
        items: history?.items.map((item) => item.id),
      });
      updateButtonStates();
    },
  );

  if (isHomeFeedPage()) {
    addNavigationButtons();
    startFeedCapture(true);
  }
  return () => {
    unwatch();
    document.removeEventListener("click", handleRefreshClick, true);
    window.removeEventListener("resize", updateButtonStyles);
    refreshClickHandlerInstalled = false;
    clearNavigationRetry();
    stopFeedCapture();
    exitHistoryView();
    document.getElementById("bili-feed-history-nav")?.remove();
    styleSourceButton?.removeEventListener("mouseleave", updateButtonStyles);
    styleSourceButton = null;
    refreshStyleSnapshot = null;
  };
}

// Add history arrows around Bilibili's "换一换" button; retries on slow pages.
export function addNavigationButtons(retries = 10): void {
  // The refresh button only exists on the home feed.
  if (!isHomeFeedPage()) {
    clearNavigationRetry();
    return;
  }

  const refreshButton = findRefreshButton();
  if (!refreshButton) {
    if (retries > 0 && buttonMountRetryTimer === undefined) {
      buttonMountRetryTimer = window.setTimeout(() => {
        buttonMountRetryTimer = undefined;
        addNavigationButtons(retries - 1);
      }, 1000);
    }
    return;
  }

  clearNavigationRetry();

  if (document.getElementById("bili-feed-history-nav")) return;

  const refreshParent = refreshButton.parentElement;
  if (!refreshParent || !refreshParent.parentElement) {
    return;
  }

  const navContainer = document.createElement("div");
  navContainer.id = "bili-feed-history-nav";
  navContainer.style.position = "absolute";
  navContainer.style.left = "50%";
  navContainer.style.transform = "translateX(-50%)";
  navContainer.style.zIndex = "2";
  navContainer.style.display = "flex";
  navContainer.style.flexDirection = "column";
  navContainer.style.alignItems = "center";
  navContainer.style.gap = "8px";

  const prevButton = document.createElement("button");
  prevButton.id = "bili-feed-prev";
  prevButton.innerHTML = "←";
  styleNavigationButton(prevButton);
  prevButton.addEventListener("click", () => {
    void runNavigation(navigateToPreviousFeed);
  });

  const nextButton = document.createElement("button");
  nextButton.id = "bili-feed-next";
  nextButton.innerHTML = "→";
  styleNavigationButton(nextButton);
  nextButton.addEventListener("click", () => {
    void runNavigation(navigateToNextFeed);
  });

  navContainer.appendChild(prevButton);
  navContainer.appendChild(nextButton);
  addDebugButton(navContainer);

  refreshParent.appendChild(navContainer);

  installRefreshClickHandler();

  updateButtonStyles();
  updateButtonStates();
}

async function runNavigation(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    // Reloading an unpacked extension invalidates buttons already injected in
    // open tabs. The refreshed content script will recreate them on page load.
    if (browser.runtime?.id) {
      console.error("Could not navigate feed history", error);
    }
  }
}

function clearNavigationRetry(): void {
  if (buttonMountRetryTimer === undefined) return;
  clearTimeout(buttonMountRetryTimer);
  buttonMountRetryTimer = undefined;
}

// Capture the outgoing feed, then watch for Bilibili's replacement.

function installRefreshClickHandler(): void {
  if (refreshClickHandlerInstalled) return;
  document.addEventListener("click", handleRefreshClick, true);
  refreshClickHandlerInstalled = true;
}

function handleRefreshClick(event: MouseEvent): void {
  if (!isHomeFeedPage()) return;

  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest("button");
  if (!(button instanceof HTMLButtonElement)) return;
  if (!isRefreshButton(button)) return;

  const historyVisible =
    document.querySelector(`[${historyHostAttribute}]`) !== null;
  trace("refresh.click", { historyVisible });
  traceHtml("refresh.before");
  captureBeforeRefresh();
  // Do not hide Bilibili's loading state behind the selected history snapshot.
  exitHistoryView();
  startFeedCapture();
}

function styleNavigationButton(button: HTMLButtonElement): void {
  button.style.padding = "5px 12px";
  button.style.cursor = "pointer";
  button.style.borderRadius = "4px";
  button.style.opacity = "1";
  button.style.transition = "all 0.2s ease";
  button.style.backgroundColor = "transparent";
}

export function updateButtonStyles(): void {
  if (!isHomeFeedPage()) return;

  const refreshButton = findRefreshButton();
  const prevButton = document.getElementById(
    "bili-feed-prev",
  ) as HTMLButtonElement;
  const nextButton = document.getElementById(
    "bili-feed-next",
  ) as HTMLButtonElement;

  if (!refreshButton || !prevButton || !nextButton) return;

  attachRefreshStyleRefresh(refreshButton);
  positionNavigationButtons(refreshButton);
  refreshButton.style.setProperty("cursor", "pointer", "important");
  const computedStyle = getComputedStyle(refreshButton);
  if (!isTransientRefreshState(refreshButton)) {
    refreshStyleSnapshot = {
      backgroundColor: computedStyle.backgroundColor,
      border: computedStyle.border,
      color: computedStyle.color,
      boxShadow: computedStyle.boxShadow,
      width: computedStyle.width,
    };
  }
  const styleSnapshot = refreshStyleSnapshot;
  if (!styleSnapshot) return;

  applyRefreshStyles(styleSnapshot, prevButton);
  applyRefreshStyles(styleSnapshot, nextButton);
}

function positionNavigationButtons(refreshButton: HTMLButtonElement): void {
  const navContainer = document.getElementById("bili-feed-history-nav");
  const parent = navContainer?.parentElement;
  const feed = parent?.parentElement;
  if (!navContainer || !parent || !feed) return;

  const feedRect = feed.getBoundingClientRect();
  const spaceAbove = refreshButton.getBoundingClientRect().top - feedRect.top;
  const placeAbove = spaceAbove >= navContainer.getBoundingClientRect().height + 8;
  navContainer.style.top = placeAbove ? "auto" : "calc(100% + 8px)";
  navContainer.style.bottom = placeAbove ? "calc(100% + 8px)" : "auto";

  const debugButton = document.getElementById("bili-feed-export-logs");
  if (debugButton && debugButton.parentElement === navContainer) {
    if (placeAbove && debugButton !== navContainer.firstElementChild) {
      navContainer.prepend(debugButton);
    } else if (!placeAbove && debugButton !== navContainer.lastElementChild) {
      navContainer.appendChild(debugButton);
    }
  }
}

function attachRefreshStyleRefresh(refreshButton: HTMLButtonElement): void {
  if (styleSourceButton === refreshButton) return;
  styleSourceButton?.removeEventListener("mouseleave", updateButtonStyles);
  styleSourceButton = refreshButton;
  refreshButton.addEventListener("mouseleave", updateButtonStyles);
}

function isTransientRefreshState(button: HTMLButtonElement): boolean {
  return button.matches(":hover") || button.matches(":active");
}

function applyRefreshStyles(
  styleSnapshot: ButtonStyleSnapshot,
  targetButton: HTMLButtonElement,
): void {
  targetButton.style.setProperty(
    "background-color",
    styleSnapshot.backgroundColor,
    "important",
  );
  targetButton.style.setProperty("border", styleSnapshot.border, "important");
  targetButton.style.setProperty("color", styleSnapshot.color, "important");
  targetButton.style.setProperty(
    "box-shadow",
    styleSnapshot.boxShadow,
    "important",
  );
  targetButton.style.setProperty("width", styleSnapshot.width, "important");
}
