import { addNavigationButtons } from "./ui";

// Setup mutation observer to watch for dynamic changes
export function setupMutationObserver(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // Check if our navigation controls exist
        if (!document.getElementById("bili-feed-history-nav")) {
          addNavigationButtons();
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
