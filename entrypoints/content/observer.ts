import { addNavigationButtons, updateButtonStyles } from "./ui";

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

export function setupThemeObserver(): void {
  if (typeof document === "undefined" || !document.documentElement) return;

  let pendingFrame = false;
  const observer = new MutationObserver(() => {
    if (pendingFrame) return;
    pendingFrame = true;
    window.requestAnimationFrame(() => {
      updateButtonStyles();
      // Re-run once after CSS variables settle
      setTimeout(updateButtonStyles, 120);
      pendingFrame = false;
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}
