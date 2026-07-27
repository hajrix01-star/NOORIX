import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DialogActions from './DialogActions';

afterEach(() => {
  cleanup();
});

describe('DialogActions', () => {
  it('renders visible actions in the governed order', () => {
    render(
      <DialogActions
        actions={[
          { key: 'save', label: 'Save', role: 'save' },
          { key: 'close', label: 'Close', role: 'close' },
          { key: 'hidden', label: 'Hidden', role: 'primary', hidden: true },
          { key: 'delete', label: 'Delete', role: 'delete' },
        ]}
      />,
    );

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['Close', 'Delete', 'Save']);
    expect(screen.queryByText('Hidden')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' }).parentElement?.classList.contains('nx-dialog-actions')).toBe(true);
  });

  it('keeps click handling centralized without changing callbacks', () => {
    const onPrint = vi.fn();

    render(
      <DialogActions
        actions={[
          { key: 'print', label: 'Print', role: 'print', onClick: onPrint },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(onPrint).toHaveBeenCalledTimes(1);
  });
});
