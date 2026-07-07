import { describe, expect, it } from 'vitest';
import {
  buildThemePreviewDemoTabs,
  buildThemePreviewTableColumns,
  getThemePreviewDemoContentKey,
  THEME_PREVIEW_TABLE_ROWS,
} from './themePreviewModel';

describe('themePreviewModel', () => {
  const t = (key: string) => `t:${key}`;

  it('builds stable demo tabs through the shared model', () => {
    expect(buildThemePreviewDemoTabs(t)).toHaveLength(7);
    expect(getThemePreviewDemoContentKey('b')).toBe('themePreviewLab3ContentB');
    expect(getThemePreviewDemoContentKey('missing')).toBe('themePreviewLab3ContentA');
  });

  it('builds typed SmartTable columns and rows', () => {
    expect(buildThemePreviewTableColumns(t).map((column) => column.key)).toEqual(['name', 'qty', 'price']);
    expect(THEME_PREVIEW_TABLE_ROWS).toHaveLength(2);
  });
});
