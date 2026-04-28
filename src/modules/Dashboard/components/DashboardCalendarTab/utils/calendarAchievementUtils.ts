import { KPI_RECHARTS_COLORS, AMBER_ACCENT_HEX } from '../../../../../constants/kpiCardTheme';

/** شرائح ثابتة: أحمر <80% | أصفر 80–99% | أخضر 100–119% | أزرق ≥120% من الهدف */
export const ACHIEVEMENT_BG = {
  red: 'color-mix(in srgb, var(--color-nx-expenses) 34%, transparent)',
  yellow: 'color-mix(in srgb, var(--noorix-accent-amber) 32%, transparent)',
  green: 'color-mix(in srgb, var(--color-nx-profit) 32%, transparent)',
  blue: 'color-mix(in srgb, var(--color-nx-sales) 32%, transparent)',
};

export function achievementBandFromRatio(ratio: number) {
  if (ratio >= 1.2) return 'blue';
  if (ratio >= 1) return 'green';
  if (ratio >= 0.8) return 'yellow';
  return 'red';
}

export function hexToRgba(hex: string, alpha: number) {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function achievementBgForPrint(band: string) {
  const a = 0.38;
  switch (band) {
    case 'blue':
      return hexToRgba(KPI_RECHARTS_COLORS.sales, a);
    case 'green':
      return hexToRgba(KPI_RECHARTS_COLORS.grossProfit, a);
    case 'yellow':
      return hexToRgba(AMBER_ACCENT_HEX, a);
    case 'red':
    default:
      return hexToRgba(KPI_RECHARTS_COLORS.expenses, a);
  }
}
