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

  it('uses the centralized filled state for active tabs and bordered state for idle tabs', () => {
    const { container } = render(
      <ConnectedTabStrip items={items} value="a" onChange={() => {}} compactMobile />,
    );

    const activeTab = container.querySelector('[role="tab"][aria-selected="true"]');
    const idleTab = container.querySelector('[role="tab"][aria-selected="false"]');

    expect(activeTab?.className).toContain('nx-connected-tab-btn--active');
    expect(activeTab?.className).toContain('!bg-[var(--noorix-accent-green)]');
    expect(activeTab?.className).toContain('!text-white');
    expect(idleTab?.className).toContain('nx-connected-tab-btn--idle');
    expect(idleTab?.className).toContain('!bg-[var(--noorix-bg-surface)]');
    expect(idleTab?.className).toContain('!border-[var(--noorix-border)]');
  });
});
