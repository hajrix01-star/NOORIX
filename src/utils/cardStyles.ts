/**
 * Shared card styling for Dashboard, Reports, and other modules.
 * All colors reference CSS variables (with hardcoded fallbacks for light mode).
 * Dark mode overrides are handled via CSS variable redefinition in the theme layer.
 *
 * Usage:
 *   const { accent, bg, border } = CARD_COLORS.sales;
 *   Bind these values through a governed component class or CSS custom property.
 */

export const CARD_BORDER_RADIUS = 14;

export const CARD_COLORS = {
  sales: {
    accent: 'var(--noorix-card-sales-accent, #16a34a)',
    bg: 'var(--noorix-card-sales-bg, rgba(22,163,74,0.08))',
    border: 'var(--noorix-card-sales-border, rgba(22,163,74,0.2))',
  },
  purchases: {
    accent: 'var(--noorix-card-purchases-accent, #dc2626)',
    bg: 'var(--noorix-card-purchases-bg, rgba(220,38,38,0.08))',
    border: 'var(--noorix-card-purchases-border, rgba(220,38,38,0.2))',
  },
  expenses: {
    accent: 'var(--noorix-card-expenses-accent, #b91c1c)',
    bg: 'var(--noorix-card-expenses-bg, rgba(185,28,28,0.08))',
    border: 'var(--noorix-card-expenses-border, rgba(185,28,28,0.2))',
  },
  grossProfit: {
    accent: 'var(--noorix-card-profit-accent, #2563eb)',
    accentLoss: 'var(--noorix-card-loss-accent, #dc2626)',
    bg: 'var(--noorix-card-profit-bg, rgba(37,99,235,0.08))',
    border: 'var(--noorix-card-profit-border, rgba(37,99,235,0.2))',
    bgLoss: 'var(--noorix-card-loss-bg, rgba(220,38,38,0.08))',
    borderLoss: 'var(--noorix-card-loss-border, rgba(220,38,38,0.2))',
  },
  netProfit: {
    accent: 'var(--noorix-card-profit-accent, #2563eb)',
    accentLoss: 'var(--noorix-card-loss-accent, #dc2626)',
    bg: 'var(--noorix-card-profit-bg, rgba(37,99,235,0.08))',
    border: 'var(--noorix-card-profit-border, rgba(37,99,235,0.2))',
    bgLoss: 'var(--noorix-card-loss-bg, rgba(220,38,38,0.08))',
    borderLoss: 'var(--noorix-card-loss-border, rgba(220,38,38,0.2))',
  },
};

