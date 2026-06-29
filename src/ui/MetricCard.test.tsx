import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MetricCard from './MetricCard';

afterEach(() => {
  cleanup();
});

describe('MetricCard.Value', () => {
  it('does not render a double negative when a negative prefix is supplied', () => {
    const { container } = render(<MetricCard.Value value={-500} prefix="−" />);
    expect(container.textContent).toContain('−500');
    expect(container.textContent).not.toContain('−-500');
    expect(container.textContent).not.toContain('--500');
  });
});
