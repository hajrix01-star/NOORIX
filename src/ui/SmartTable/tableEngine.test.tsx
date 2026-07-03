import { afterEach, describe, expect, it, vi } from 'vitest';
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
  sortKey,
  sortDir,
  page,
  pageSize,
  total,
  onSort,
  onPageChange,
}: {
  data?: Row[];
  smartColumns?: SmartTableColumn<Row>[];
  sortKey?: string;
  sortDir?: 'asc' | 'desc' | string;
  page?: number;
  pageSize?: number;
  total?: number;
  onSort?: (key: string) => void;
  onPageChange?: (page: number) => void;
}) {
  const engine = useSmartTableEngine({
    columns: smartColumns,
    data,
    sortKey,
    sortDir,
    page,
    pageSize,
    total,
    onSort,
    onPageChange,
  });
  const tableColumns = engine.table.getAllLeafColumns();
  const nameState = engine.getColumnState('name');
  const amountState = engine.getColumnState('amount');

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
      <span data-testid="table-sorting">
        {engine.table.getState().sorting.map((sort) => `${sort.id}:${sort.desc ? 'desc' : 'asc'}`).join(',')}
      </span>
      <span data-testid="name-state">
        {[
          nameState.isSorted ? 'sorted' : 'idle',
          nameState.sortDir ?? 'none',
          nameState.ariaSort,
          nameState.sortIndicator,
          nameState.canSort ? 'can' : 'cannot',
        ].join(':')}
      </span>
      <span data-testid="amount-state">
        {[
          amountState.isSorted ? 'sorted' : 'idle',
          amountState.sortDir ?? 'none',
          amountState.ariaSort,
          amountState.sortIndicator,
          amountState.canSort ? 'can' : 'cannot',
        ].join(':')}
      </span>
      <span data-testid="table-pagination">
        {`${engine.table.getState().pagination.pageIndex}:${engine.table.getState().pagination.pageSize}`}
      </span>
      <span data-testid="engine-pagination">
        {`${engine.pagination.page}:${engine.pagination.pageIndex}:${engine.pagination.safePageSize}:${engine.pagination.totalPages}`}
      </span>
      <button type="button" onClick={() => engine.toggleSort('name')}>
        sort-name
      </button>
      <button type="button" onClick={() => engine.toggleSort('amount')}>
        sort-amount
      </button>
      <button type="button" onClick={() => engine.setPage(4)}>
        page-4
      </button>
      <button type="button" onClick={() => engine.setPage(0)}>
        page-0
      </button>
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

  it('maps controlled SmartTable sorting into TanStack state without sorting rows internally', () => {
    render(<EngineProbe sortKey="name" sortDir="asc" onSort={() => undefined} />);

    expect(screen.getByTestId('table-sorting').textContent).toBe('name:asc');
    expect(screen.getByTestId('name-state').textContent).toBe('sorted:asc:ascending:▲:can');
    expect(screen.getByTestId('amount-state').textContent).toBe('idle:none:none:⇅:cannot');
    expect(screen.getByTestId('row-order').textContent).toBe('Alpha,Beta');
  });

  it('keeps sort toggles delegated to the external SmartTable callback', () => {
    const onSort = vi.fn();
    render(<EngineProbe onSort={onSort} />);

    screen.getByText('sort-name').click();
    screen.getByText('sort-amount').click();

    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('maps controlled pagination into TanStack state and clamps page size safely', () => {
    render(<EngineProbe page={3} pageSize={25} total={120} />);

    expect(screen.getByTestId('table-pagination').textContent).toBe('2:25');
    expect(screen.getByTestId('engine-pagination').textContent).toBe('3:2:25:5');
  });

  it('keeps pagination changes delegated to the external SmartTable callback', () => {
    const onPageChange = vi.fn();
    render(<EngineProbe page={1} pageSize={25} total={120} onPageChange={onPageChange} />);

    screen.getByText('page-4').click();
    screen.getByText('page-0').click();

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('normalizes invalid page sizes before passing pagination state to TanStack', () => {
    render(<EngineProbe page={2} pageSize={0} total={3} />);

    expect(screen.getByTestId('table-pagination').textContent).toBe('1:1');
    expect(screen.getByTestId('engine-pagination').textContent).toBe('2:1:1:3');
  });
});
