import { describe, expect, it } from 'vitest';
import {
  buildThemePreviewContainerMatrixColumns,
  buildThemePreviewContainerSimpleColumns,
  buildThemePreviewContainerSmartColumns,
  buildThemePreviewDemoTabs,
  buildThemePreviewTableColumns,
  getThemePreviewDemoContentKey,
  THEME_PREVIEW_CONTAINER_ROWS,
  THEME_PREVIEW_MATRIX_ROWS,
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

  it('builds table container showcase models', () => {
    expect(buildThemePreviewContainerSmartColumns().map((column) => column.key)).toEqual([
      'id',
      'label',
      'owner',
      'date',
      'tax',
      'amount',
      'status',
    ]);
    expect(buildThemePreviewContainerSimpleColumns().map((column) => column.key)).toEqual([
      'label',
      'date',
      'amount',
      'tax',
      'status',
    ]);
    expect(buildThemePreviewContainerMatrixColumns().map((column) => column.key)).toEqual([
      'item',
      'jan',
      'feb',
      'total',
    ]);
    expect(THEME_PREVIEW_CONTAINER_ROWS).toHaveLength(3);
    expect(THEME_PREVIEW_MATRIX_ROWS).toHaveLength(4);
  });
});
