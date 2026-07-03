import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ColorSwatch from './ColorSwatch';

describe('ColorSwatch', () => {
  it('renders runtime background and fallback colors', () => {
    const { rerender } = render(
      <ColorSwatch data-testid="swatch" color="#123456" className="h-3 w-3" />,
    );

    expect(screen.getByTestId('swatch').style.backgroundColor).toBe('#123456');
    expect(screen.getByTestId('swatch').className).toContain('h-3');
    expect(screen.getByTestId('swatch').className).toContain('w-3');

    rerender(<ColorSwatch data-testid="swatch" color="" fallbackColor="#abcdef" />);

    expect(screen.getByTestId('swatch').style.backgroundColor).toBe('#abcdef');
  });

  it('can render a div container with text color', () => {
    render(
      <ColorSwatch as="div" data-testid="brand-icon" color="#111111" textColor="#ffffff">
        N
      </ColorSwatch>,
    );

    expect(screen.getByTestId('brand-icon').tagName).toBe('DIV');
    expect(screen.getByTestId('brand-icon').style.backgroundColor).toBe('#111111');
    expect(screen.getByTestId('brand-icon').style.color).toBe('#ffffff');
  });
});
