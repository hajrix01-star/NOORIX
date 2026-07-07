import { afterEach, describe, expect, it, vi } from 'vitest';
import { openPrintWindow, printCurrentWindow, printCurrentWindowAfterDelay, printCurrentWindowNextFrame } from './printUtils';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('printUtils', () => {
  it('opens escaped print html through the central print window', () => {
    const write = vi.fn();
    const close = vi.fn();
    const printWindow = {
      document: { write, close },
      close: vi.fn(),
      print: vi.fn(),
      onafterprint: null as (() => void) | null,
      onload: null as (() => void) | null,
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);

    openPrintWindow({
      title: '<Title>',
      companyName: '<Company>',
      subtitle: '<Period>',
      body: '<main>trusted report body</main>',
      autoPrint: false,
    });

    const html = String(write.mock.calls[0]?.[0] ?? '');
    expect(html).toContain('&lt;Title&gt;');
    expect(html).toContain('&lt;Company&gt;');
    expect(html).toContain('&lt;Period&gt;');
    expect(html).toContain('<main>trusted report body</main>');
    expect(close).toHaveBeenCalledOnce();
  });

  it('centralizes current-window print scheduling helpers', () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(1);
      return 1;
    });

    printCurrentWindow();
    printCurrentWindowNextFrame();
    const timer = printCurrentWindowAfterDelay(25);
    vi.advanceTimersByTime(25);

    expect(timer).toBeDefined();
    expect(requestFrame).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledTimes(3);
  });
});
