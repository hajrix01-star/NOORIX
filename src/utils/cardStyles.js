/**
 * Shared card styling for Dashboard, Reports, and other modules.
 * CARD_COLORS and CARD_BORDER_RADIUS used for consistent card appearance.
 */
export const CARD_BORDER_RADIUS = 14;

export const CARD_COLORS = {
  sales: { accent: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' },
  purchases: { accent: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)' },
  expenses: { accent: '#b91c1c', bg: 'rgba(185,28,28,0.08)', border: 'rgba(185,28,28,0.2)' },
  grossProfit: { accent: '#2563eb', accentLoss: '#dc2626', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.2)', bgLoss: 'rgba(220,38,38,0.08)', borderLoss: 'rgba(220,38,38,0.2)' },
  netProfit: { accent: '#2563eb', accentLoss: '#dc2626', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.2)', bgLoss: 'rgba(220,38,38,0.08)', borderLoss: 'rgba(220,38,38,0.2)' },
};
