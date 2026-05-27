import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { placeColVisPanel } from './SmartTable';

function mockRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 40,
    height: 32,
    top: 0,
    left: 0,
    right: 40,
    bottom: 32,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

describe('placeColVisPanel', () => {
  const prevDir = document.documentElement.dir;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390, writable: true });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844, writable: true });
  });

  afterEach(() => {
    document.documentElement.dir = prevDir;
  });

  it('keeps RTL panel inside viewport when button is near the right edge', () => {
    document.documentElement.dir = 'rtl';
    const btn = document.createElement('button');
    const panel = document.createElement('div');
    document.body.append(btn, panel);
    mockRect(btn, { left: 320, right: 360, top: 80, bottom: 112 });
    Object.defineProperty(panel, 'offsetWidth', { value: 200 });
    Object.defineProperty(panel, 'offsetHeight', { value: 240 });

    const { left } = placeColVisPanel(btn, panel);
    expect(left).toBeGreaterThanOrEqual(12);
    expect(left + 200).toBeLessThanOrEqual(390 - 12);

    btn.remove();
    panel.remove();
  });

  it('anchors LTR panel to the button trailing edge', () => {
    document.documentElement.dir = 'ltr';
    const btn = document.createElement('button');
    const panel = document.createElement('div');
    document.body.append(btn, panel);
    mockRect(btn, { left: 300, right: 340, top: 80, bottom: 112 });
    Object.defineProperty(panel, 'offsetWidth', { value: 200 });
    Object.defineProperty(panel, 'offsetHeight', { value: 240 });

    const { left } = placeColVisPanel(btn, panel);
    expect(left).toBe(140);

    btn.remove();
    panel.remove();
  });
});
