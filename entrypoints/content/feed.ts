export const historyCardAttribute = "data-bili-feed-history-card";
export const historyHostAttribute = "data-bili-feed-history-host";

export function getLiveFeedCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".feed-card")).filter(
    (card) => !card.closest(`[${historyCardAttribute}]`)
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
