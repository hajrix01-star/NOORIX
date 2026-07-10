let fallbackSpecialDayCounter = 0;

export function createDashboardSpecialDayId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sp-${crypto.randomUUID()}`;
  }
  fallbackSpecialDayCounter += 1;
  return `sp-local-${fallbackSpecialDayCounter}`;
}
