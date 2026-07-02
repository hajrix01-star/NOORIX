import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EditableCheckboxCell from './EditableCheckboxCell';
import EditableNumberCell from './EditableNumberCell';
import EditableTextCell from './EditableTextCell';
import FileTrigger from './FileTrigger';
import InlineSelect from './InlineSelect';

afterEach(() => {
  cleanup();
});

describe('editable control primitives', () => {
  it('renders compact text and number cells', () => {
    render(
      <>
        <EditableTextCell aria-label="Name" value="Item" readOnly />
        <EditableNumberCell aria-label="Qty" value={12} readOnly />
      </>,
    );

    expect(screen.getByLabelText('Name').getAttribute('type')).toBe('text');
    expect(screen.getByLabelText('Qty').getAttribute('type')).toBe('number');
    expect(screen.getByLabelText('Qty').classList.contains('text-end')).toBe(true);
  });

  it('marks invalid editable controls with aria-invalid', () => {
    render(
      <>
        <EditableTextCell aria-label="Invalid text" invalid />
        <InlineSelect aria-label="Invalid select" invalid>
          <option value="x">X</option>
        </InlineSelect>
      </>,
    );

    expect(screen.getByLabelText('Invalid text').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Invalid select').getAttribute('aria-invalid')).toBe('true');
  });

  it('renders dense checkbox cells without label wrappers', () => {
    render(<EditableCheckboxCell aria-label="Select row" checked readOnly containerClassName="cell-hit-area" />);

    const input = screen.getByLabelText('Select row') as HTMLInputElement;
    expect(input.type).toBe('checkbox');
    expect(input.checked).toBe(true);
    expect(document.querySelector('.cell-hit-area input')).toBe(input);
  });

  it('renders an inline select with options', () => {
    render(
      <InlineSelect aria-label="Mode" defaultValue="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </InlineSelect>,
    );

    expect((screen.getByLabelText('Mode') as HTMLSelectElement).value).toBe('b');
  });

  it('uses a Noorix button to trigger a hidden file input', () => {
    render(<FileTrigger label="Upload CSV" accept=".csv" />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);

    expect(input.accept).toBe('.csv');
    fireEvent.click(screen.getByRole('button', { name: 'Upload CSV' }));
    expect(click).toHaveBeenCalledTimes(1);

    click.mockRestore();
  });
});
