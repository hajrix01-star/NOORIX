export function printCurrentInvoiceWindow() {
  window.print();
}

export function printCurrentInvoiceWindowNextFrame() {
  requestAnimationFrame(() => printCurrentInvoiceWindow());
}
