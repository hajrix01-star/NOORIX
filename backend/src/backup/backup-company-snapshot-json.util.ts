/** تسلسل لقطة منطقية للشركة مع استبدال Decimal بسلسلة للـ JSON. */
export function stringifyLogicalSnapshotReplacingDecimals(snapshot: unknown): string {
  return JSON.stringify(snapshot, (_, v) => {
    if (v != null && typeof v === 'object' && v.constructor?.name === 'Decimal') return String(v);
    return v;
  });
}
