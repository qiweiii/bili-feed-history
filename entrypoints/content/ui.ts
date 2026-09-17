import { startFeedCapture, stopFeedCapture } from "./capture";
import {
  navigateToPreviousFeed,
  navigateToNextFeed,
  updateButtonStates,
  exitHistoryView,
} from "./navigation";
import { FeedHistory } from "./types";

let navigationRetryTimer: number | undefined;
let refreshClickHandlerInstalled = false;

export function isHomeFeedPage(): boolean {
  return location.pathname === "/";
}

// Set up all UI components
export function setupUI(): () => void {
  installRefreshClickHandler();

  const unwatch = storage.watch<FeedHistory>("local:biliFeedHistory", () => {
    updateButtonStates();
  });

  if (isHomeFeedPage()) {
    addNavigationButtons();
    startFeedCapture(true);
  }
  return () => {
    unwatch();
    document.removeEventListener("click", handleRefreshClick, true);
    refreshClickHandlerInstalled = false;
    clearNavigationRetry();
    stopFeedCapture();
    exitHistoryView();
    document.getElementById("bili-feed-history-nav")?.remove();
  };
}

// Add navigation buttons below "换一换" button
export function addNavigationButtons(retries = 10): void {
  // Not on video/watch pages - the 换一换 button only exists on the home feed.
  if (!isHomeFeedPage()) {
    clearNavigationRetry();
    return;
  }

  // Find the "换一换" button
  const refreshButton = findRefreshButton();
  if (!refreshButton) {
    if (retries > 0 && navigationRetryTimer === undefined) {
      navigationRetryTimer = window.setTimeout(() => {
        navigationRetryTimer = undefined;
        addNavigationButtons(retries - 1);
      }, 1000);
    }
    return;
  }

  clearNavigationRetry();

  // Check if our navigation controls already exist
  if (document.getElementById("bili-feed-history-nav")) return;

  // Get the container where the refresh button is positioned
  const refreshParent = refreshButton.parentElement;
  if (!refreshParent || !refreshParent.parentElement) {
    return;
  }

  // Create navigation container with similar styles to the refresh button's parent
  const navContainer = document.createElement("div");
  navContainer.id = "bili-feed-history-nav";
  navContainer.style.position = "absolute";
  navContainer.style.top = "105px"; // Position below the refresh button
  navContainer.style.left = "100%";
  navContainer.style.transform = "translate(10px)";
  navContainer.style.zIndex = "2";
  navContainer.style.display = "flex";
  navContainer.style.flexDirection = "column";
  navContainer.style.gap = "8px";

  // Previous button with similar styling to refresh button
  const prevButton = document.createElement("button");
  prevButton.id = "bili-feed-prev";
  prevButton.innerHTML = "←";
  styleNavigationButton(prevButton);
  prevButton.addEventListener("click", navigateToPreviousFeed);

  // Next button with similar styling
  const nextButton = document.createElement("button");
  nextButton.id = "bili-feed-next";
  nextButton.innerHTML = "→";
  styleNavigationButton(nextButton);
  nextButton.addEventListener("click", navigateToNextFeed);

  // Add buttons to container
  navContainer.appendChild(prevButton);
  navContainer.appendChild(nextButton);

  // Add the container to the same parent as the refresh button's parent
  const grandParent = refreshParent.parentElement;
  grandParent.style.position = grandParent.style.position || "relative";
  grandParent.appendChild(navContainer);

  installRefreshClickHandler();

  updateButtonStyles();
  updateButtonStates();
}

function clearNavigationRetry(): void {
  if (navigationRetryTimer === undefined) return;
  clearTimeout(navigationRetryTimer);
  navigationRetryTimer = undefined;
}

// ---- Refresh capture ----


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

  // Let Bilibili handle its own live feed DOM before starting a new capture.
  exitHistoryView();
  startFeedCapture();
}

function isRefreshButton(button: HTMLButtonElement): boolean {
  return (
    button.textContent?.includes("换一换") === true ||
    button.matches("button.primary-btn.roll-btn")
  );
}

// Find the "换一换" button in the DOM
function findRefreshButton(): HTMLButtonElement | null {
  // Method 1: Look for button elements with span containing "换一换"
  let button = Array.from(document.querySelectorAll("button")).find(
    (button) => {
      const span = button.querySelector("span");
      return span && span.textContent?.includes("换一换");
    }
  ) as HTMLButtonElement | null;

  if (button) return button;

  // Method 2: Look for buttons with specific class that might contain the refresh button
  button = document.querySelector(
    "button.primary-btn.roll-btn"
  ) as HTMLButtonElement | null;
  return button;
}

function styleNavigationButton(button: HTMLButtonElement): void {
  button.style.padding = "5px 12px";
  button.style.cursor = "pointer";
  button.style.borderRadius = "4px";
  button.style.opacity = "0.8";
  button.style.transition = "all 0.2s ease";
  button.style.backgroundColor = "transparent";
}

export function updateButtonStyles(): void {
  if (!isHomeFeedPage()) return;

  const refreshButton = findRefreshButton();
  const prevButton = document.getElementById(
    "bili-feed-prev"
  ) as HTMLButtonElement;
  const nextButton = document.getElementById(
    "bili-feed-next"
  ) as HTMLButtonElement;

  if (!refreshButton || !prevButton || !nextButton) return;

  applyRefreshStyles(refreshButton, prevButton);
  applyRefreshStyles(refreshButton, nextButton);
}

function applyRefreshStyles(
  refreshButton: HTMLButtonElement,
  targetButton: HTMLButtonElement
): void {
  const computedStyle = getComputedStyle(refreshButton);
  targetButton.style.backgroundColor = computedStyle.backgroundColor;
  targetButton.style.border = computedStyle.border;
  targetButton.style.color = computedStyle.color;
  targetButton.style.boxShadow = computedStyle.boxShadow;
  targetButton.style.width = computedStyle.width;
}
