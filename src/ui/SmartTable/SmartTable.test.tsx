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

  it('keeps row number widths on the unified fixed width', () => {
    const { container } = render(
      <SmartTable
        columns={columns}
        data={rows}
        total={2}
        showRowNumbers
        footerRow={[{ keys: ['name', 'amount'], content: 'Total' }]}
      />,
    );

    const rowNumberHeader = container.querySelector('thead th') as HTMLTableCellElement;
    const rowNumberCell = container.querySelector('tbody tr:first-child td') as HTMLTableCellElement;
    const footerRowNumberCell = container.querySelector('tfoot td') as HTMLTableCellElement;

    expect(rowNumberHeader.style.getPropertyValue('--nx-smart-row-number-width')).toBe('34px');
    expect(rowNumberCell.style.getPropertyValue('--nx-smart-row-number-width')).toBe('34px');
    expect(footerRowNumberCell.style.getPropertyValue('--nx-smart-row-number-width')).toBe('34px');
    expect(rowNumberHeader.style.getPropertyValue('--nx-smart-cell-height')).toBe('38px');
    expect(rowNumberCell.style.getPropertyValue('--nx-smart-cell-height')).toBe('42px');
    expect(footerRowNumberCell.style.getPropertyValue('--nx-smart-cell-height')).toBe('42px');
    expect(rowNumberCell.style.getPropertyValue('--nx-smart-cell-padding')).toBe('4px 6px');
  });

  it('renders a colgroup with normalized compact column sizes', () => {
    const { container } = render(
      <SmartTable
        columns={[
          { key: 'invoiceNumber', label: 'Doc', kind: 'id' },
          { key: 'serialNumber', label: 'Serial', kind: 'id' },
          { key: 'serviceNumber', label: 'Code', kind: 'id' },
          { key: 'daysToWarrantyEnd', label: 'Days', kind: 'number' },
          { key: 'taxAmount', label: 'Tax', kind: 'money' },
          { key: 'totalAmount', label: 'Total', kind: 'money' },
          { key: 'actions', label: 'Actions', kind: 'actions' },
        ]}
        data={[{
          id: '1',
          invoiceNumber: 'PUR-20260708-001',
          serialNumber: 'NO-AS-001',
          serviceNumber: '12',
          daysToWarrantyEnd: 30,
          taxAmount: 15,
          totalAmount: 115,
        }]}
        total={1}
        showRowNumbers
      />,
    );

    const cols = Array.from(container.querySelectorAll('col'));
    expect(cols).toHaveLength(8);
    expect(cols[1].getAttribute('data-column-size')).toBe('document');
    expect(cols[2].getAttribute('data-column-size')).toBe('serial-code');
    expect(cols[3].getAttribute('data-column-size')).toBe('code-sm');
    expect(cols[4].getAttribute('data-column-size')).toBe('count');
    expect(cols[5].getAttribute('data-column-size')).toBe('tax');
    expect(cols[6].getAttribute('data-column-size')).toBe('money-md');
    expect(cols[7].getAttribute('data-column-kind')).toBe('actions');
    expect((cols[7] as HTMLElement).style.width).toBe('44px');
    expect((container.querySelector('th[data-column-size="tax"]') as HTMLElement).style.getPropertyValue('--nx-smart-cell-width')).toBe('8ch');
  });

  it('keeps shrink fallback widths aligned across colgroup, header, and body cells', () => {
    const { container } = render(
      <SmartTable
        columns={[{ key: 'notes', label: 'Notes', shrink: true }]}
        data={[{ id: '1', notes: 'Short note' }]}
        total={1}
      />,
    );

    const col = container.querySelector('col[data-column-kind="text"]') as HTMLTableColElement;
    const header = container.querySelector('th[data-column-kind="text"]') as HTMLElement;
    const cell = container.querySelector('td[data-column-kind="text"]') as HTMLElement;

    expect(col.style.width).toBe('1%');
    expect(header.style.getPropertyValue('--nx-smart-cell-width')).toBe('1%');
    expect(cell.style.getPropertyValue('--nx-smart-cell-width')).toBe('1%');
  });

  it('applies the central alignment policy from normalized column sizes', () => {
    const { container } = render(
      <SmartTable
        columns={[
          { key: 'nameAr', label: 'Name' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'purchaseDate', label: 'Date' },
          { key: 'acquisitionCost', label: 'Cost', numeric: true },
        ]}
        data={[{ id: '1', nameAr: 'Asset', supplier: 'Supplier', purchaseDate: '2026-07-08', acquisitionCost: 575 }]}
        total={1}
      />,
    );

    const cells = Array.from(container.querySelectorAll('tbody td')) as HTMLElement[];
    expect(cells[0].getAttribute('data-column-size')).toBe('name');
    expect(cells[0].style.getPropertyValue('--nx-smart-cell-align')).toBe('start');
    expect(cells[1].getAttribute('data-column-size')).toBe('supplier');
    expect(cells[1].style.getPropertyValue('--nx-smart-cell-align')).toBe('start');
    expect(cells[2].getAttribute('data-column-size')).toBe('date');
    expect(cells[2].style.getPropertyValue('--nx-smart-cell-align')).toBe('center');
    expect(cells[3].getAttribute('data-column-size')).toBe('money-sm');
    expect(cells[3].style.getPropertyValue('--nx-smart-cell-align')).toBe('end');
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
