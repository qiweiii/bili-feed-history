import { setupStorage } from "./storage";
import { setupUI } from "./ui";
import { setupMutationObserver } from "./observer";

export default defineContentScript({
  matches: ["https://www.bilibili.com/*"],
  main() {
    console.log("Bilibili Feed History extension loaded");

    // Initialize everything
    setupStorage()
      .then(() => {
        // Setup UI components and save initial feed
        setupUI();
      })
      .then(() => {
        // Watch for DOM changes
        setupMutationObserver();
      });
  },
});
