import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FloatingPanel from './FloatingPanel';

describe('FloatingPanel', () => {
  it('centralizes fixed positioning and runtime dimensions', () => {
    render(
      <FloatingPanel
        data-testid="panel"
        top={12}
        left={24}
        width={320}
        maxHeight={280}
        zIndex="var(--nx-z-menu)"
        boxShadow="0 8px 24px rgba(0,0,0,0.12)"
        direction="rtl"
        className="rounded"
      />,
    );

    const panel = screen.getByTestId('panel');
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.top).toBe('12px');
    expect(panel.style.left).toBe('24px');
    expect(panel.style.width).toBe('320px');
    expect(panel.style.maxHeight).toBe('280px');
    expect(panel.style.zIndex).toBe('var(--nx-z-menu)');
    expect(panel.style.direction).toBe('rtl');
    expect(panel.className).toContain('rounded');
  });
});
