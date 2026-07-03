import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useSmartTableEngine } from './tableEngine';
import type { SmartTableColumn } from './types';

type Row = {
  id: string;
  name: string;
  amount: number;
};

const columns: SmartTableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'amount', label: 'Amount', numeric: true },
];

const rows: Row[] = [
  { id: '1', name: 'Alpha', amount: 100 },
  { id: '2', name: 'Beta', amount: 200 },
];

function EngineProbe({
  data = rows,
  smartColumns = columns,
}: {
  data?: Row[];
  smartColumns?: SmartTableColumn<Row>[];
}) {
  const engine = useSmartTableEngine({ columns: smartColumns, data });
  const tableColumns = engine.table.getAllLeafColumns();

  return (
    <output>
      <span data-testid="row-order">{engine.rows.map((row) => row.original.name).join(',')}</span>
      <span data-testid="row-indexes">{engine.rows.map((row) => row.index).join(',')}</span>
      <span data-testid="column-ids">{tableColumns.map((col) => col.id).join(',')}</span>
      <span data-testid="sorting-enabled">
        {tableColumns.map((col) => `${col.id}:${col.getCanSort() ? 'yes' : 'no'}`).join(',')}
      </span>
      <span data-testid="manual-flags">
        {String(engine.table.options.manualSorting)}:{String(engine.table.options.manualPagination)}
      </span>
      <span data-testid="meta-column">
        {(tableColumns[0].columnDef.meta as any)?.noorixColumn?.key}
      </span>
      <span data-testid="public-columns">
        {engine.columns.map((col) => col.key).join(',')}
      </span>
    </output>
  );
}

describe('useSmartTableEngine', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the Noorix row order as the TanStack core row model', () => {
    render(<EngineProbe />);

    expect(screen.getByTestId('row-order').textContent).toBe('Alpha,Beta');
    expect(screen.getByTestId('row-indexes').textContent).toBe('0,1');
  });

  it('maps Noorix columns into TanStack columns without replacing the public column API', () => {
    render(<EngineProbe />);

    expect(screen.getByTestId('column-ids').textContent).toBe('name,amount');
    expect(screen.getByTestId('public-columns').textContent).toBe('name,amount');
    expect(screen.getByTestId('meta-column').textContent).toBe('name');
  });

  it('keeps sorting and pagination manual for external SmartTable compatibility', () => {
    render(<EngineProbe />);

    expect(screen.getByTestId('manual-flags').textContent).toBe('true:true');
    expect(screen.getByTestId('sorting-enabled').textContent).toBe('name:yes,amount:no');
  });

  it('updates the row model when caller data changes', () => {
    const { rerender } = render(<EngineProbe data={rows} />);

    expect(screen.getByTestId('row-order').textContent).toBe('Alpha,Beta');

    rerender(<EngineProbe data={[rows[1]]} />);

    expect(screen.getByTestId('row-order').textContent).toBe('Beta');
    expect(screen.getByTestId('row-indexes').textContent).toBe('0');
  });
});
