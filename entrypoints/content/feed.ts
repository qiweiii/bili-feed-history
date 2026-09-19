import { getFeedCards, isLoginCard } from "./bilibili";

export const historyCardAttribute = "data-bili-feed-history-card";
export const historyHostAttribute = "data-bili-feed-history-host";

export function isDisplayed(card: HTMLElement): boolean {
  for (let node: HTMLElement | null = card; node; node = node.parentElement) {
    if (
      node.style.display === "none" ||
      getComputedStyle(node).display === "none"
    )
      return false;
  }
  return true;
}

export function getLiveFeedCards(): HTMLElement[] {
  return getFeedCards().filter((card) => {
    if (card.closest(`[${historyCardAttribute}]`)) return false;
    return isDisplayed(card);
  });
}

export function feedIdentity(cards: HTMLElement[]): string {
  const signatures = cards.map((card) => {
    if (isLoginCard(card)) {
      return "www.bilibili.com/guest-login-card";
    }

    const links = Array.from(
      card.querySelectorAll<HTMLAnchorElement>("a[href]"),
    ).filter((link) => !link.closest(`[${historyCardAttribute}]`));
    const link =
      links.find((link) => link.getAttribute("href")?.includes("/video/")) ??
      links[0];
    const href = link?.getAttribute("href");
    if (!href) return "";
    try {
      const url = new URL(href, "https://www.bilibili.com/");
      return url.host + url.pathname;
    } catch {
      return "";
    }
  });
  return signatures.length && signatures.every(Boolean)
    ? signatures.join("\u001f")
    : "";
}

export function snapshotSignature(html: string): string {
  const snapshotRoot = document.createElement("div");
  snapshotRoot.innerHTML = html;
  return feedIdentity(
    getFeedCards(snapshotRoot).filter(isDisplayed),
  );
}

export function serializeFeedCards(cards: HTMLElement[]): string {
  const snapshot = document.createElement("div");
  cards.forEach((card) => {
    const clone = card.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(`[${historyCardAttribute}]`).forEach((node) => {
      node.remove();
    });
    clone.removeAttribute(historyHostAttribute);
    snapshot.appendChild(clone);
  });
  return snapshot.innerHTML;
}
