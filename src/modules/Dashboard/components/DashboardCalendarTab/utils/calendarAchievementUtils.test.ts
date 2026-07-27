import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_BG,
  calendarSalesHeatBg,
  calendarSalesHeatBgForPrint,
  calendarSpecialIdleBg,
} from './calendarAchievementUtils';

describe('calendarAchievementUtils', () => {
  it('keeps sales heat based on the target when a day has sales', () => {
    expect(calendarSalesHeatBg(120, 100, 200)).toBe(ACHIEVEMENT_BG.blue);
    expect(calendarSalesHeatBg(95, 100, 200)).toBe(ACHIEVEMENT_BG.yellow);
    expect(calendarSalesHeatBg(70, 100, 200)).toBe(ACHIEVEMENT_BG.red);
  });

  it('uses proportional heat when no target exists', () => {
    expect(calendarSalesHeatBg(50, null, 100)).toBe(
      'color-mix(in srgb, var(--color-nx-profit) 29%, transparent)',
    );
  });

  it('uses special day color only when there is no sales heat', () => {
    expect(calendarSpecialIdleBg('#123456')).toBe('rgba(18,52,86,0.16)');
    expect(calendarSalesHeatBg(120, 100, 200)).not.toBe('rgba(18,52,86,0.16)');
  });

  it('keeps print heat based on sales performance', () => {
    expect(calendarSalesHeatBgForPrint(0, 100, 200)).toBe('#f8fafc');
    expect(calendarSalesHeatBgForPrint(120, 100, 200)).toContain('rgba(');
  });
});
