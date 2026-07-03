import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SmartTable from './SmartTable';
import type { SmartTableColumn } from './types';

vi.mock('../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) =>
      key === 'pageLabel' ? `Page ${args[0]}/${args[1]}` : key,
    lang: 'ar',
  }),
}));

vi.mock('../../hooks/useMediaQuery', () => ({
  useIsNarrow768: () => false,
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
    render(
      <SmartTable
        tableId="test-cols"
        columns={columns}
        data={rows}
        total={2}
        title="Cols"
      />,
    );
    fireEvent.click(screen.getByLabelText('إظهار / إخفاء الأعمدة'));
    const panel = document.body.querySelector('.nx-col-vis-panel--viewport');
    expect(panel).toBeTruthy();
    expect(screen.getByText('الأعمدة')).toBeTruthy();
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

});
