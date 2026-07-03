import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DataBar from './DataBar';

describe('DataBar', () => {
  it('renders bounded width, height, and runtime color', () => {
    const { rerender } = render(
      <DataBar data-testid="bar" widthPercent={140} heightPx={24} color="#123456" />,
    );

    expect(screen.getByTestId('bar').style.width).toBe('100%');
    expect(screen.getByTestId('bar').style.height).toBe('24px');
    expect(screen.getByTestId('bar').style.backgroundColor).toBe('#123456');

    rerender(<DataBar data-testid="bar" widthPercent={-20} heightPx={-5} />);

    expect(screen.getByTestId('bar').style.width).toBe('0%');
    expect(screen.getByTestId('bar').style.height).toBe('0px');
  });
});
