import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import KebabMenu from './KebabMenu';

describe('KebabMenu', () => {
  it('renders the unified actions icon instead of a three-dot trigger', () => {
    render(
      <KebabMenu
        ariaLabel="Actions"
        items={[{ key: 'edit', label: 'Edit', onClick: vi.fn() }]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger.querySelector('.nx-actions-icon')).toBeTruthy();
    expect(trigger.querySelectorAll('circle')).toHaveLength(0);
    expect(trigger.getAttribute('title')).toBe('Actions');
  });
});
