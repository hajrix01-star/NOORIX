import { describe, expect, it } from 'vitest';
import { removeEmbeddedPrintToolbar } from './printPreviewHtml';

describe('removeEmbeddedPrintToolbar', () => {
  it('removes the embedded top print action while preserving the document', () => {
    const html = `<!doctype html><html><body>
      <div class="print-toolbar"><button onclick="window.print()">Print</button></div>
      <main id="report">Report body</main>
    </body></html>`;

    const result = removeEmbeddedPrintToolbar(html);

    expect(result).not.toContain('print-toolbar');
    expect(result).not.toContain('onclick="window.print()"');
    expect(result).toContain('<main id="report">Report body</main>');
  });

  it('keeps documents that do not contain an embedded toolbar unchanged', () => {
    const html = '<html><body><main>Report</main></body></html>';
    expect(removeEmbeddedPrintToolbar(html)).toBe(html);
  });
});
