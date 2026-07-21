export function formatSalesShiftSharePercent(percent: number): string {
  if (!Number.isFinite(percent)) return '0';
  const rounded = Math.round(percent * 10) / 10;
  if (Object.is(rounded, -0)) return '0';
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}
