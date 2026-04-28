import type { CSSProperties } from 'react';

export type ImportEntityType = 'invoices' | 'employees' | 'sales';

export type ImportValidationResult = {
  valid: boolean;
  rowNum: number;
  payload?: Record<string, unknown>;
  errors: string[];
  warnings: string[];
};

export type ImportProgressRow = { rowNum: number | string; message: string };

export type ImportProgressState = {
  current: number;
  total: number;
  succeeded: number;
  failed: number;
  errors: ImportProgressRow[];
  warnings: ImportProgressRow[];
};

export type LookupsState = {
  suppliers: unknown[];
  vaults: unknown[];
  categories: unknown[];
  expenseLines: unknown[];
};

export type EntityConfig = {
  labelKey: string;
  downloadTemplate: (() => Promise<void>) | null;
  validate: ((rows: Record<string, unknown>[]) => unknown) | null;
  batchSize: number;
  parallel: boolean;
  exportFilename: string;
};

export type ImportExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  entityType: ImportEntityType;
  companyId: string;
  exportFetcher?: () => Promise<Record<string, unknown>[]>;
  onImportSuccess?: (count: number) => void;
};

export type ImportPhaseStepItem = { n: number; label: string };

/** Inline styles bundle used by import UI (unchanged structure) */
export type ImportExportStyles = {
  tabs: CSSProperties;
  tab: (active: boolean) => CSSProperties;
  sectionTitle: CSSProperties;
  card: CSSProperties;
  dropzone: (dragging: boolean) => CSSProperties;
  errorRow: CSSProperties;
  warnRow: CSSProperties;
};
