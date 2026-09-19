const bilibiliSelectors = {
  feedCard: ".feed-card",
  loginCard: ".bili-login-card",
  refreshButton: "button.primary-btn.roll-btn",
} as const;

const refreshButtonLabel = "换一换";

/** Bilibili route contract used by the homepage content script. */
export function isHomeFeedPage(pathname = location.pathname): boolean {
  return pathname === "/";
}

/** Return Bilibili's feed cards from a document or saved snapshot fragment. */
export function getFeedCards(root: ParentNode = document): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(bilibiliSelectors.feedCard),
  );
}

export function isLoginCard(card: HTMLElement): boolean {
  return card.querySelector(bilibiliSelectors.loginCard) !== null;
}

export function findRefreshButton(): HTMLButtonElement | null {
  const textButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.includes(refreshButtonLabel),
  );
  if (textButton) return textButton as HTMLButtonElement;

  return document.querySelector<HTMLButtonElement>(
    bilibiliSelectors.refreshButton,
  );
}

export function isRefreshButton(button: HTMLButtonElement): boolean {
  return (
    button.textContent?.includes(refreshButtonLabel) === true ||
    button.matches(bilibiliSelectors.refreshButton)
  );
}
