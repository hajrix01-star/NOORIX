import { describe, expect, it } from 'vitest';
import { buildPrintTableHtml, escapePrintHtml, sanitizePrintClassName } from './printTableHtml';

describe('printTableHtml', () => {
  it('escapes text content and attribute-sensitive characters', () => {
    expect(escapePrintHtml(`<script>"x" & 'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
    );
  });

  it('removes unsafe class tokens', () => {
    expect(sanitizePrintClassName('valid-name another_ok x" onclick="bad <bad>')).toBe('valid-name another_ok');
  });

  it('builds table html with headers, rows, alignment, and escaped values', () => {
    const html = buildPrintTableHtml({
      columns: [
        { key: 'name', header: 'Name' },
        { key: 'amount', header: 'Amount', align: 'center' },
      ],
      rows: [{ name: '<Admin>', amount: 42 }],
      tableClassName: 'safe-table bad"class',
    });

    expect(html).toContain('<table class="safe-table">');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<th class="print-table__cell--center">Amount</th>');
    expect(html).toContain('<td>&lt;Admin&gt;</td>');
    expect(html).toContain('<td class="print-table__cell--center">42</td>');
  });

  it('renders an empty state with the correct colspan', () => {
    const html = buildPrintTableHtml({
      columns: [
        { key: 'name', header: 'Name' },
        { key: 'amount', header: 'Amount' },
      ],
      rows: [],
      emptyMessage: 'Nothing here',
    });

    expect(html).toContain('<td class="print-table__empty-cell" colspan="2">Nothing here</td>');
  });

  it('supports row classes and footer rows', () => {
    const html = buildPrintTableHtml({
      columns: [{ key: 'total', header: 'Total', align: 'right' }],
      rows: [{ total: 100 }],
      rowMetas: [{ className: 'summary-row invalid"attr' }],
      footerRows: [[{ value: 'Grand total', colSpan: 1, align: 'right', className: 'footer-total' }]],
    });

    expect(html).toContain('<tr class="summary-row">');
    expect(html).toContain('<tfoot><tr><td class="print-table__cell--right footer-total">Grand total</td></tr></tfoot>');
  });
});
