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
  useIsNarrow700: () => false,
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
    const sortableHeader = container.querySelector('th[style*="cursor: pointer"]');
    expect(sortableHeader).toBeTruthy();
    fireEvent.click(sortableHeader!);
    expect(onSort).toHaveBeenCalledWith('name');
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
});
