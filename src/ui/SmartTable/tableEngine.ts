import { useMemo } from 'react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type Table,
} from '@tanstack/react-table';
import type { SmartTableColumn } from './types';
import { columnLabel } from './columnUtils';

export type SmartTableEngineRow<TRow> = {
  id: string;
  index: number;
  original: TRow;
  tanstackRow: Row<TRow>;
};

export type SmartTableEngineResult<TRow> = {
  table: Table<TRow>;
  rows: SmartTableEngineRow<TRow>[];
  columns: SmartTableColumn<TRow>[];
};

export function useSmartTableEngine<TRow extends Record<string, any>>({
  columns,
  data,
}: {
  columns: SmartTableColumn<TRow>[];
  data: TRow[];
}): SmartTableEngineResult<TRow> {
  const columnDefs = useMemo<Array<ColumnDef<TRow, unknown>>>(
    () =>
      columns.map((col) => ({
        id: col.key,
        accessorFn: (row) => row[col.key],
        header: () => columnLabel(col),
        enableSorting: Boolean(col.sortable),
        meta: { noorixColumn: col },
      })),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const rows = table.getRowModel().rows.map((row) => ({
    id: row.id,
    index: row.index,
    original: row.original,
    tanstackRow: row,
  }));

  return {
    table,
    rows,
    columns,
  };
}
