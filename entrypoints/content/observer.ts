import {
  addNavigationButtons,
  updateButtonStyles,
} from "./controls";
import { updateHistoryCardStyles } from "./navigation";
import { isHomeFeedPage } from "./bilibili";

// Setup mutation observer to watch for dynamic changes
export function setupMutationObserver(): () => void {
  let pending = false;
  let disposed = false;
  const observer = new MutationObserver(() => {
    if (!isHomeFeedPage()) return;

    // Bilibili mutates the DOM constantly; collapse bursts into one check.
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(() => {
      pending = false;
      if (disposed) return;
      if (document.getElementById("bili-feed-history-nav")) {
        updateButtonStyles();
      } else {
        addNavigationButtons();
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  return () => {
    disposed = true;
    observer.disconnect();
  };
}

export function setupThemeObserver(): () => void {

  let pendingFrame = false;
  let disposed = false;
  const observer = new MutationObserver(() => {
    if (pendingFrame) return;
    pendingFrame = true;
    window.requestAnimationFrame(() => {
      pendingFrame = false;
      if (disposed || !isHomeFeedPage()) return;
      updateButtonStyles();
      updateHistoryCardStyles();
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => {
    disposed = true;
    observer.disconnect();
  };
}
