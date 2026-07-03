import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SimpleTable, { type SimpleTableColumn } from './SimpleTable';

type Row = { id: string; name: string; amount: number; status: string };

const columns: SimpleTableColumn<Row>[] = [
  { key: 'name', label: 'Name' },
  {
    key: 'amount',
    label: 'Amount',
    numeric: true,
    render: (value) => `SR ${value}`,
  },
  { key: 'status', label: 'Status' },
];

const rows: Row[] = [
  { id: 'a', name: 'Alpha', amount: 100, status: 'ok' },
  { id: 'b', name: 'Beta', amount: 200, status: 'warn' },
];

afterEach(() => {
  cleanup();
});

describe('SimpleTable', () => {
  it('renders headers, rows, and custom cell renderers', () => {
    render(<SimpleTable columns={columns} data={rows} />);

    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('SR 100')).toBeTruthy();
  });

  it('renders an empty state with the correct colspan', () => {
    const { container } = render(<SimpleTable columns={columns} data={[]} emptyMessage="No rows" />);

    expect(screen.getByText('No rows')).toBeTruthy();
    expect(container.querySelector('tbody td')?.getAttribute('colspan')).toBe('3');
  });

  it('keeps headers sticky when requested', () => {
    const { container } = render(
      <SimpleTable columns={columns} data={rows} maxHeight={120} stickyHeader />,
    );

    const wrapper = container.querySelector('.noorix-table-scroll-wrapper') as HTMLElement;
    const header = container.querySelector('thead th') as HTMLElement;

    expect(wrapper.style.getPropertyValue('--nx-dg-scroll-max-height')).toBe('120px');
    expect(wrapper.style.getPropertyValue('--nx-dg-scroll-overflow-y')).toBe('auto');
    expect(header.className).toContain('nx-dg-var-th--sticky');
  });

  it('renders footer rows when provided', () => {
    render(
      <SimpleTable
        columns={columns}
        data={rows}
        footer={(
          <tr>
            <td>Total</td>
            <td>SR 300</td>
            <td />
          </tr>
        )}
      />,
    );

    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('SR 300')).toBeTruthy();
  });
});
