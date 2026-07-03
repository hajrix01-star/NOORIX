import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MatrixTable, { type MatrixTableColumn } from './MatrixTable';

type MatrixRow = {
  id: string;
  name: string;
  january: number;
  total: number;
  color: string;
};

const rows: MatrixRow[] = [
  { id: 'a', name: 'Alpha', january: 120, total: 320, color: '#0ea5e9' },
  { id: 'b', name: 'Beta', january: 0, total: 80, color: '#22c55e' },
];

const columns: MatrixTableColumn<MatrixRow>[] = [
  {
    key: 'name',
    label: 'Company',
    minWidth: 140,
    align: 'start',
    render: (value) => <span className="truncate">{value as string}</span>,
  },
  {
    key: 'january',
    label: 'Jan',
    numeric: true,
    minWidth: 64,
    getCellStyle: (row) => (row.january > 100 ? { background: 'rgba(14, 165, 233, 0.08)' } : undefined),
  },
  {
    key: 'total',
    label: 'Total',
    numeric: true,
  },
];

afterEach(() => {
  cleanup();
});

describe('MatrixTable', () => {
  it('renders matrix headers, rows, numeric cells, and row accents', () => {
    const { container } = render(
      <MatrixTable
        columns={columns}
        data={rows}
        tableMinWidth={720}
        getRowAccentColor={(row) => row.color}
      />,
    );

    expect(screen.getByText('Company')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('320')).toBeTruthy();
    expect(container.querySelector('.noorix-table-frame')).toBeTruthy();
    expect(container.querySelector('td[data-numeric="true"]')).toBeTruthy();
    expect((container.querySelector('tbody span span') as HTMLElement).style.background).toBe('#0ea5e9');
  });

  it('applies table sizing and data-driven cell styles centrally', () => {
    const { container } = render(<MatrixTable columns={columns} data={rows} tableMinWidth={860} maxHeight={240} />);

    const wrapper = container.querySelector('.noorix-table-scroll-wrapper') as HTMLElement;
    const table = container.querySelector('table') as HTMLElement;
    const hotCell = container.querySelector('tbody td[data-numeric="true"]') as HTMLElement;

    expect(wrapper.style.maxHeight).toBe('240px');
    expect(wrapper.style.overflowY).toBe('auto');
    expect(table.style.minWidth).toBe('860px');
    expect(hotCell.style.background).toBe('rgba(14, 165, 233, 0.08)');
  });

  it('renders empty state with full matrix colspan', () => {
    const { container } = render(<MatrixTable columns={columns} data={[]} emptyMessage="No matrix rows" />);

    expect(screen.getByText('No matrix rows')).toBeTruthy();
    expect(container.querySelector('tbody td')?.getAttribute('colspan')).toBe('3');
  });

  it('renders footer rows', () => {
    render(
      <MatrixTable
        columns={columns}
        data={rows}
        footer={(
          <tr>
            <td>Total</td>
            <td>120</td>
            <td>400</td>
          </tr>
        )}
      />,
    );

    expect(screen.getByText('400')).toBeTruthy();
  });
});
