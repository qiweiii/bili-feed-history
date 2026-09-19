export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
      // Keep in sync with feedHistoryStorageKey in content/storage.ts.
      void storage.removeItem("local:biliFeedHistory");
    }
  });
});
