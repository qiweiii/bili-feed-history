import { saveFeedItems } from "./storage";
import {
  navigateToPreviousFeed,
  navigateToNextFeed,
  updateButtonStates,
} from "./navigation";
import { FeedHistory } from "./types";

// Set up all UI components
export function setupUI(): void {
  saveFeedItems();
  addNavigationButtons();

  storage.watch<FeedHistory>("local:biliFeedHistory", (newValue, oldValue) => {
    updateButtonStates();
  });
}

// Add navigation buttons below "换一换" button
export function addNavigationButtons(): void {
  // Find the "换一换" button
  const refreshButton = findRefreshButton();
  if (!refreshButton) {
    setTimeout(addNavigationButtons, 1000); // Try again later
    return;
  }

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
  navContainer.style.top = "100px"; // Position below the refresh button
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
  prevButton.style.padding = "5px 12px";
  prevButton.style.cursor = "pointer";
  prevButton.style.backgroundColor =
    refreshButton.style.backgroundColor || "#ffffff";
  prevButton.style.border = refreshButton.style.border || "1px solid #e3e5e7";
  prevButton.style.borderRadius = "4px";
  prevButton.style.opacity = "0.8";
  prevButton.addEventListener("click", navigateToPreviousFeed);

  // Next button with similar styling
  const nextButton = document.createElement("button");
  nextButton.id = "bili-feed-next";
  nextButton.innerHTML = "→";
  nextButton.style.padding = "5px 12px";
  nextButton.style.cursor = "pointer";
  nextButton.style.backgroundColor =
    refreshButton.style.backgroundColor || "#ffffff";
  nextButton.style.border = refreshButton.style.border || "1px solid #e3e5e7";
  nextButton.style.borderRadius = "4px";
  nextButton.style.opacity = "0.8";
  nextButton.addEventListener("click", navigateToNextFeed);

  // Add buttons to container
  navContainer.appendChild(prevButton);
  navContainer.appendChild(nextButton);

  // Add the container to the same parent as the refresh button's parent
  const grandParent = refreshParent.parentElement;
  grandParent.style.position = grandParent.style.position || "relative";
  grandParent.appendChild(navContainer);

  // Add event listener to the refresh button
  refreshButton.addEventListener("click", () => {
    // Wait a moment for the new content to load
    setTimeout(() => {
      // ensure old ones are removed
      removeOldItems();
      // save to storage
      saveFeedItems();
    }, 600);
  });

  updateButtonStates();
}

// remove my current items first if .feed-card count > 10
function removeOldItems(): void {
  const feedCards = document.querySelectorAll(".feed-card");
  if (feedCards.length > 10) {
    feedCards.forEach((card, index) => {
      if (index < 10) {
        card.remove();
      }
    });
  }
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
  if (button) return button;
  else {
    throw new Error("Refresh button not found");
  }
}
