import { saveFeedItems } from "./storage";
import {
  navigateToPreviousFeed,
  navigateToNextFeed,
  updateButtonStates,
} from "./navigation";

// Set up all UI components
export function setupUI(): void {
  saveFeedItems();
  addNavigationButtons();
}

// Add navigation buttons below "换一换" button
export function addNavigationButtons(): void {
  // Find the "换一换" button
  const refreshButton = findRefreshButton();
  if (!refreshButton) {
    console.log("Could not find the '换一换' button");
    setTimeout(addNavigationButtons, 1000); // Try again later
    return;
  }

  // Check if our navigation controls already exist
  if (document.getElementById("bili-feed-history-nav")) return;

  // Create navigation container
  const navContainer = document.createElement("div");
  navContainer.id = "bili-feed-history-nav";
  navContainer.style.display = "flex";
  navContainer.style.justifyContent = "center";
  navContainer.style.marginTop = "10px";

  // Previous button
  const prevButton = document.createElement("button");
  prevButton.id = "bili-feed-prev";
  prevButton.innerHTML = "←";
  prevButton.style.marginRight = "10px";
  prevButton.style.padding = "5px 15px";
  prevButton.style.cursor = "pointer";
  prevButton.addEventListener("click", navigateToPreviousFeed);

  // Next button
  const nextButton = document.createElement("button");
  nextButton.id = "bili-feed-next";
  nextButton.innerHTML = "→";
  nextButton.style.padding = "5px 15px";
  nextButton.style.cursor = "pointer";
  nextButton.addEventListener("click", navigateToNextFeed);

  // Add buttons to container
  navContainer.appendChild(prevButton);
  navContainer.appendChild(nextButton);

  // Add container after the refresh button
  const parentElement = refreshButton.parentElement;
  if (parentElement) {
    if (parentElement.nextSibling) {
      parentElement.parentNode?.insertBefore(
        navContainer,
        parentElement.nextSibling
      );
    } else {
      parentElement.parentNode?.appendChild(navContainer);
    }
  }

  // Add event listener to the refresh button
  refreshButton.addEventListener("click", () => {
    // Wait a moment for the new content to load
    setTimeout(saveFeedItems, 1000);
  });

  // Update button states
  updateButtonStates();
}

// Find the "换一换" button in the DOM
export function findRefreshButton(): HTMLButtonElement | null {
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

  // Method 3: Fallback to any button with SVG and span with "换一换" text
  button = Array.from(document.querySelectorAll("button")).find((button) => {
    const hasSvg = button.querySelector("svg");
    const span = button.querySelector("span");
    return hasSvg && span && span.textContent?.includes("换一换");
  }) as HTMLButtonElement | null;

  // Method 4: Original fallback method
  if (!button) {
    button = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("换一换")
    ) as HTMLButtonElement | null;
  }

  return button;
}
