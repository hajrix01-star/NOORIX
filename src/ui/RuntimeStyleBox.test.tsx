import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RuntimeStyleBox from './RuntimeStyleBox';

describe('RuntimeStyleBox', () => {
  it('renders constrained runtime background, border, and color styles', () => {
    render(
      <RuntimeStyleBox
        data-testid="surface"
        background="rgba(10, 20, 30, 0.2)"
        border="2px solid #123456"
        color="#abcdef"
        className="rounded-md"
      >
        Runtime value
      </RuntimeStyleBox>,
    );

    const surface = screen.getByTestId('surface');
    expect(surface.tagName).toBe('DIV');
    expect(surface.style.background).toBe('rgba(10, 20, 30, 0.2)');
    expect(surface.style.border).toBe('2px solid #123456');
    expect(surface.style.color).toBe('#abcdef');
    expect(surface.className).toContain('rounded-md');
  });

  it('can render inline text with runtime color only', () => {
    render(
      <RuntimeStyleBox as="span" data-testid="label" color="#654321">
        Label
      </RuntimeStyleBox>,
    );

    const label = screen.getByTestId('label');
    expect(label.tagName).toBe('SPAN');
    expect(label.style.color).toBe('#654321');
    expect(label.style.background).toBe('');
    expect(label.style.border).toBe('');
  });
});
