import { setupStorage } from "./storage";
import { setupUI } from "./ui";
import { setupMutationObserver, setupThemeObserver } from "./observer";

export default defineContentScript({
  matches: ["https://www.bilibili.com/"],
  async main(ctx) {
    await setupStorage();
    if (!ctx.isValid) return;
    let cleanup: (() => void)[] = [];
    const stop = () => {
      cleanup.splice(0).forEach((dispose) => dispose());
    };
    const start = () => {
      stop();
      cleanup = [setupUI(), setupMutationObserver(), setupThemeObserver()];
    };
    if (location.pathname === "/") start();
    ctx.addEventListener(window, "wxt:locationchange", (event) => {
      stop();
      // WXT may notify before the browser commits the new location.
      if (event.newUrl.pathname === "/") {
        ctx.setTimeout(() => {
          if (location.pathname === "/") start();
        }, 0);
      }
    });
    ctx.onInvalidated(stop);
  },
});
