import { isHomeFeedPage } from "./bilibili";
import { setupStorage } from "./storage";
import { setupUI } from "./controls";
import { setupMutationObserver, setupThemeObserver } from "./observer";
import { trace } from "./debug";

export default defineContentScript({
  matches: ["https://www.bilibili.com/"],
  async main(ctx) {
    ctx.addEventListener(document, "visibilitychange", () => {
      trace("page.visibility", { visibility: document.visibilityState });
    });
    ctx.addEventListener(window, "pageshow", (event) =>
      trace("page.show", { persisted: event.persisted }),
    );
    ctx.addEventListener(window, "pagehide", (event) =>
      trace("page.hide", { persisted: event.persisted }),
    );
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
    if (isHomeFeedPage()) start();
    ctx.addEventListener(window, "wxt:locationchange", (event) => {
      stop();
      // WXT may notify before the browser commits the new location.
      if (isHomeFeedPage(event.newUrl.pathname)) {
        ctx.setTimeout(() => {
          if (isHomeFeedPage()) start();
        }, 0);
      }
    });
    ctx.onInvalidated(stop);
  },
});
