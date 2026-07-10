import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChartState from './ChartState';

afterEach(() => {
  cleanup();
});

describe('ChartState', () => {
  it('marks loading state as busy status', () => {
    render(<ChartState kind="loading">Loading chart</ChartState>);

    const state = screen.getByRole('status');
    expect(state.getAttribute('aria-busy')).toBe('true');
    expect(state.textContent).toContain('Loading chart');
  });

  it('marks error state as alert', () => {
    render(<ChartState kind="error">Chart failed</ChartState>);

    expect(screen.getByRole('alert').textContent).toContain('Chart failed');
  });
});
