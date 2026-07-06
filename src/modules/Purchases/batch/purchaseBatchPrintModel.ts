export function printCurrentPurchaseBatchWindow() {
  window.print();
}

export function printCurrentPurchaseBatchWindowAfterDelay(delayMs = 300) {
  return window.setTimeout(() => printCurrentPurchaseBatchWindow(), delayMs);
}
