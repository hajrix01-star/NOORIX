import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPrintDocumentHtml } from './printUtils';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('printUtils', () => {
  it('builds escaped central print-preview html', () => {
    const html = buildPrintDocumentHtml({
      title: '<Title>',
      companyName: '<Company>',
      subtitle: '<Period>',
      body: '<main>trusted report body</main>',
      autoPrint: false,
    });

    expect(html).toContain('&lt;Title&gt;');
    expect(html).toContain('&lt;Company&gt;');
    expect(html).toContain('&lt;Period&gt;');
    expect(html).toContain('<main>trusted report body</main>');
    expect(html).toContain('onclick="window.print()"');
  });
});
