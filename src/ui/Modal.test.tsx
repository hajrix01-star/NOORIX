import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Modal from './Modal';

afterEach(() => {
  cleanup();
});

describe('Modal', () => {
  it('does not render when closed', () => {
    render(
      <Modal open={false} title="Hidden">
        Body
      </Modal>,
    );
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('renders title and children when open', () => {
    render(
      <Modal open title="Confirm">
        <p>Modal body</p>
      </Modal>,
    );
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Modal body')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Dialog" onClose={onClose}>
        Content
      </Modal>,
    );
    const closeButtons = screen.getAllByRole('button', { name: 'إغلاق' });
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
