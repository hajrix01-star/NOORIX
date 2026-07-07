import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SummaryBar from './SummaryBar';

afterEach(() => {
  cleanup();
});

describe('SummaryBar', () => {
  it('keeps negative numbers negative unless a prefix is supplied', () => {
    const { container } = render(
      <SummaryBar
        items={[
          { key: 'balance', label: 'Balance', value: -500, currency: 'SR' },
        ]}
      />,
    );

    expect(container.textContent).toContain('-500');
  });

  it('uses an explicit prefix with the absolute numeric value', () => {
    const { container } = render(
      <SummaryBar
        items={[
          { key: 'balance', label: 'Balance', value: -500, prefix: '-', currency: 'SR' },
        ]}
      />,
    );

    expect(container.textContent).toContain('-500');
    expect(container.textContent).not.toContain('--500');
  });
});
