export default defineBackground(() => {
  // Listen for extension installation or update events
  browser.runtime.onInstalled.addListener((details) => {
    // If this is an update, clear local storage
    if (details.reason === "update") {
      console.log("Extension updated. Clearing local storage...");
      browser.storage.local.clear(() => {
        console.log("Local storage cleared successfully.");
      });
    }
  });
});
