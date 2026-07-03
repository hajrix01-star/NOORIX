import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MatrixTable, { type MatrixTableColumn } from './MatrixTable';

type MatrixRow = {
  id: string;
  name: string;
  january: number;
  total: number;
  color: string;
  kind?: 'group' | 'summary' | 'total';
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
    expect((container.querySelector('tbody span span') as HTMLElement).style.getPropertyValue('--nx-dg-accent-color')).toBe('#0ea5e9');
  });

  it('applies table sizing and data-driven cell styles centrally', () => {
    const { container } = render(
      <MatrixTable
        columns={columns}
        data={rows}
        tableMinWidth={860}
        maxHeight={240}
        stickyHeader
      />,
    );

    const wrapper = container.querySelector('.noorix-table-scroll-wrapper') as HTMLElement;
    const table = container.querySelector('table') as HTMLElement;
    const header = container.querySelector('thead th') as HTMLElement;
    const hotCell = container.querySelector('tbody td[data-numeric="true"]') as HTMLElement;

    expect(wrapper.style.getPropertyValue('--nx-dg-scroll-max-height')).toBe('240px');
    expect(wrapper.style.getPropertyValue('--nx-dg-scroll-overflow-y')).toBe('auto');
    expect(table.style.getPropertyValue('--nx-dg-min-width')).toBe('860px');
    expect(header.className).toContain('nx-dg-var-th--sticky');
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

  it('supports row tones, row styles, row headers, captions, and aria labels', () => {
    const { container } = render(
      <MatrixTable
        ariaLabel="Owner comparison matrix"
        caption="Owner monthly comparison"
        columns={columns}
        data={[{ ...rows[0], kind: 'group' }]}
        firstColumnAsHeader
        getRowTone={(row) => row.kind}
        getRowStyle={() => ({ background: 'rgba(15, 47, 87, 0.04)' })}
      />,
    );

    const table = screen.getByLabelText('Owner comparison matrix');
    const caption = screen.getByText('Owner monthly comparison');
    const row = container.querySelector('tbody tr') as HTMLElement;
    const rowHeader = container.querySelector('tbody th[scope="row"]') as HTMLElement;

    expect(table).toBeTruthy();
    expect(caption.className).toContain('sr-only');
    expect(row.className).toContain('font-bold');
    expect(row.style.background).toBe('rgba(15, 47, 87, 0.04)');
    expect(rowHeader).toBeTruthy();
    expect(rowHeader.textContent).toContain('Alpha');
  });
});
