import React from 'react';

export function renderRawCellValue(value: unknown): React.ReactNode {
  if (value == null) return '-';
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || React.isValidElement(value)
  ) {
    return value;
  }
  return String(value);
}

export function readRowValue(row: object, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}
