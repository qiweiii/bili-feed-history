import { saveFeedItems, getFeedHistory } from "./storage";
import { navigateToPreviousFeed, navigateToNextFeed } from "./navigation";

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
  // Look for button elements with text "换一换"
  const buttons = Array.from(document.querySelectorAll("button"));
  return (
    (buttons.find((button) =>
      button.textContent?.includes("换一换")
    ) as HTMLButtonElement) || null
  );
}

// Update navigation button states
export async function updateButtonStates(): Promise<void> {
  const history = await getFeedHistory();

  const prevButton = document.getElementById(
    "bili-feed-prev"
  ) as HTMLButtonElement;
  const nextButton = document.getElementById(
    "bili-feed-next"
  ) as HTMLButtonElement;

  if (!prevButton || !nextButton) return;

  // Disable prev button if at the beginning
  prevButton.disabled = history.currentIndex <= 0;
  prevButton.style.opacity = prevButton.disabled ? "0.5" : "1";

  // Disable next button if at the end
  nextButton.disabled = history.currentIndex >= history.items.length - 1;
  nextButton.style.opacity = nextButton.disabled ? "0.5" : "1";
}
