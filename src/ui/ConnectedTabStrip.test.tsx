import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConnectedTabStrip from './ConnectedTabStrip';

vi.mock('../hooks/useUiDir', () => ({
  useUiDir: () => 'rtl',
}));

describe('ConnectedTabStrip', () => {
  const items = [
    { id: 'a', label: 'تبويب أول طويل' },
    { id: 'b', label: 'تبويب ثانٍ' },
    { id: 'c', label: 'تبويب ثالث' },
    { id: 'd', label: 'تبويب رابع' },
  ];

  it('uses compact mobile layout without invisible strut labels', () => {
    const { container } = render(
      <ConnectedTabStrip items={items} value="a" onChange={() => {}} compactMobile />,
    );
    const invis = container.querySelectorAll('.invisible');
    expect(invis.length).toBe(0);
    expect(screen.getByRole('tab', { name: 'تبويب أول طويل' })).toBeTruthy();
  });

  it('keeps strut labels on desktop scroll mode', () => {
    const { container } = render(
      <ConnectedTabStrip items={items} value="a" onChange={() => {}} compactMobile={false} />,
    );
    expect(container.querySelectorAll('.invisible').length).toBeGreaterThan(0);
  });
});
