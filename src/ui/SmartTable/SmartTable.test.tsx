import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SmartTable from './SmartTable';
import type { SmartTableColumn } from './types';

const mediaState = vi.hoisted(() => ({ isNarrow: false }));

vi.mock('../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) =>
      key === 'pageLabel' ? `Page ${args[0]}/${args[1]}` : key,
    lang: 'ar',
  }),
}));

vi.mock('../responsive', () => ({
  useIsNarrow768: () => mediaState.isNarrow,
}));

vi.mock('../../hooks/useUiDir', () => ({
  useUiDir: () => 'rtl',
}));

type Row = { id: string; name: string; amount: number };

const columns: SmartTableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true },
  {
    key: 'amount',
    label: 'Amount',
    numeric: true,
    render: (_v, row) => row.amount,
  },
];

const rows: Row[] = [
  { id: '1', name: 'Alpha', amount: 100 },
  { id: '2', name: 'Beta', amount: 200 },
];

describe('SmartTable', () => {
  beforeEach(() => {
    mediaState.isNarrow = false;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders rows and column headers', () => {
    render(<SmartTable columns={columns} data={rows} total={2} title="Test table" />);
    expect(screen.getByText('Test table')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('shows empty message when data is empty', () => {
    render(<SmartTable columns={columns} data={[]} total={0} emptyMessage="No rows" />);
    expect(screen.getByText('No rows')).toBeTruthy();
  });

  it('uses the central translated load error by default', () => {
    render(<SmartTable columns={columns} data={[]} isError />);
    expect(screen.getByRole('alert').textContent).toBe('loadDataFailed');
  });

  it('calls onSort when sortable header clicked', () => {
    const onSort = vi.fn();
    const { container } = render(
      <SmartTable columns={columns} data={rows} total={2} onSort={onSort} sortKey="name" sortDir="asc" />,
    );
    const sortableHeader = container.querySelector('th[style*="--nx-smart-cell-cursor: pointer"]');
    expect(sortableHeader).toBeTruthy();
    fireEvent.click(sortableHeader!);
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('portals column visibility panel to document body', () => {
    const { container } = render(
      <SmartTable
        tableId="test-cols"
        columns={columns}
        data={rows}
        total={2}
        title="Cols"
      />,
    );
    const trigger = container.querySelector('.nx-col-vis-btn') as HTMLButtonElement;
    expect(trigger).toBeTruthy();

    fireEvent.click(trigger);

    const panel = document.body.querySelector('.nx-col-vis-panel--viewport');
    expect(panel).toBeTruthy();
    expect(panel?.querySelectorAll('.nx-col-vis-item')).toHaveLength(2);
  });

  it('renders pagination when total exceeds pageSize', () => {
    render(
      <SmartTable
        columns={columns}
        data={rows}
        total={120}
        page={1}
        pageSize={50}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText('Page 1/3')).toBeTruthy();
  });

  it('renders internal pagination when client pagination is enabled without external callbacks', () => {
    render(
      <SmartTable
        columns={columns}
        data={rows}
        pageSize={1}
        paginationMode="client"
      />,
    );

    expect(screen.getByText('Page 1/2')).toBeTruthy();
  });

  it('calls onPageChange from pagination controls without changing the external page contract', () => {
    const onPageChange = vi.fn();
    render(
      <SmartTable
        columns={columns}
        data={rows}
        total={120}
        page={2}
        pageSize={50}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('previousPage'));
    fireEvent.click(screen.getByLabelText('nextPage'));

    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('keeps search input controlled by the caller', () => {
    const onSearchChange = vi.fn();
    render(
      <SmartTable
        columns={columns}
        data={rows}
        total={2}
        searchValue="Al"
        onSearchChange={onSearchChange}
      />,
    );

    const input = screen.getByLabelText('searchPlaceholder') as HTMLInputElement;
    expect(input.value).toBe('Al');
    fireEvent.change(input, { target: { value: 'Beta' } });
    expect(onSearchChange).toHaveBeenCalledWith('Beta');
  });

  it('can search rows internally when client filtering is enabled', () => {
    render(
      <SmartTable
        columns={columns}
        data={rows}
        filteringMode="client"
      />,
    );

    const input = screen.getByLabelText('searchPlaceholder') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'bet' } });

    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('enables client filtering through the single dataMode shortcut', () => {
    render(
      <SmartTable
        columns={columns}
        data={rows}
        dataMode="client"
      />,
    );

    fireEvent.change(screen.getByLabelText('searchPlaceholder'), { target: { value: 'alp' } });

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
    expect(screen.queryByText('Page 1/2')).toBeNull();
  });

  it('lets explicit modes override the dataMode shortcut', () => {
    render(
      <SmartTable
        columns={columns}
        data={rows}
        dataMode="client"
        filteringMode="manual"
      />,
    );

    expect(screen.queryByLabelText('searchPlaceholder')).toBeNull();
  });

  it('shows the empty state when client filtering has no matching rows', () => {
    render(
      <SmartTable
        columns={columns}
        data={rows}
        filteringMode="client"
        emptyMessage="No matches"
      />,
    );

    fireEvent.change(screen.getByLabelText('searchPlaceholder'), { target: { value: 'zzz' } });

    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('applies normalized column kinds to headers and cells', () => {
    const { container } = render(<SmartTable columns={columns} data={rows} total={2} />);
    expect(container.querySelector('th[data-column-kind="text"]')).toBeTruthy();
    expect(container.querySelector('td[data-column-kind="text"]')).toBeTruthy();
    expect(container.querySelector('th[data-column-kind="money"]')).toBeTruthy();
    expect(container.querySelector('td[data-column-kind="money"]')).toBeTruthy();
  });

  it('keeps truncation classes display-safe on table cells', () => {
    const { container } = render(<SmartTable columns={columns} data={rows} total={2} />);

    expect(container.querySelector('th.noorix-cell-truncate')).toBeNull();
    expect(container.querySelector('td.noorix-cell-truncate')).toBeNull();
    expect(container.querySelector('th.noorix-table-cell-truncate')).toBeTruthy();
    expect(container.querySelector('td.noorix-table-cell-truncate')).toBeTruthy();
  });

  it('uses the unified table frame inset by default', () => {
    const { container } = render(<SmartTable columns={columns} data={rows} total={2} />);

    const frame = container.querySelector('.noorix-table-frame') as HTMLElement;
    expect(frame.style.getPropertyValue('--nx-smart-frame-padding')).toBe('8px');
  });

  it('normalizes percentage row number widths to a readable fixed width', () => {
    const { container } = render(
      <SmartTable columns={columns} data={rows} total={2} showRowNumbers rowNumberWidth="1%" />,
    );

    const rowNumberHeader = container.querySelector('thead th') as HTMLTableCellElement;
    const rowNumberCell = container.querySelector('tbody tr:first-child td') as HTMLTableCellElement;

    expect(rowNumberHeader.style.getPropertyValue('--nx-smart-row-number-width')).toBe('40px');
    expect(rowNumberCell.style.getPropertyValue('--nx-smart-row-number-width')).toBe('40px');
  });

  it('removes hidden columns from the rendered table layout', () => {
    localStorage.setItem('nx-col-vis:hidden-layout-test', JSON.stringify(['amount']));
    const { container } = render(
      <SmartTable tableId="hidden-layout-test" columns={columns} data={rows} total={2} />,
    );

    expect(container.querySelector('th[data-column-kind="money"]')).toBeNull();
    expect(container.querySelector('td[data-column-kind="money"]')).toBeNull();
    expect(container.querySelectorAll('thead th')).toHaveLength(1);
    expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(1);
    localStorage.removeItem('nx-col-vis:hidden-layout-test');
  });

  it('builds footerRow colspans against visible columns only', () => {
    localStorage.setItem('nx-col-vis:footer-layout-test', JSON.stringify(['amount']));
    const { container } = render(
      <SmartTable
        tableId="footer-layout-test"
        columns={columns}
        data={rows}
        total={2}
        footerRow={[{ keys: ['name'], content: 'Visible total' }]}
      />,
    );

    expect(screen.getByText('Visible total')).toBeTruthy();
    expect(container.querySelectorAll('tfoot td')).toHaveLength(1);
    expect((container.querySelector('tfoot td') as HTMLTableCellElement).colSpan).toBe(1);
  });

  it('preserves row class, row style, and expanded row contracts', () => {
    const { container } = render(
      <SmartTable
        columns={columns}
        data={rows}
        total={2}
        getRowClassName={(row) => (row.id === '1' ? 'is-first-row' : undefined)}
        getRowStyle={(row) => (row.id === '1' ? { '--nx-test-row-tone': 'gold' } as any : undefined)}
        isRowExpanded={(row) => row.id === '1'}
        renderExpandedRow={(row) => <div>Expanded {row.name}</div>}
      />,
    );

    const firstRow = container.querySelector('tbody tr.is-first-row') as HTMLTableRowElement;
    expect(firstRow).toBeTruthy();
    expect(firstRow.style.getPropertyValue('--nx-test-row-tone')).toBe('gold');
    expect(screen.getByText('Expanded Alpha')).toBeTruthy();
  });

  it('uses keyExtractor for rows without id and avoids React duplicate key warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SmartTable
        columns={columns}
        data={[
          { name: 'Alpha', amount: 100 },
          { name: 'Alpha', amount: 200 },
        ] as Row[]}
        total={2}
        keyExtractor={(row, index) => `${row.name}-${index}`}
      />,
    );

    expect(screen.getAllByText('Alpha')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('Encountered two children with the same key'));
  });

  it('keeps compact row rendering powered by the same ordered row model on narrow screens', () => {
    mediaState.isNarrow = true;
    render(
      <SmartTable
        columns={columns}
        data={rows}
        total={2}
        renderCompactRow={(row, index) => <span>{index}:{row.name}</span>}
      />,
    );

    expect(screen.getByText('0:Alpha')).toBeTruthy();
    expect(screen.getByText('1:Beta')).toBeTruthy();
  });
});
