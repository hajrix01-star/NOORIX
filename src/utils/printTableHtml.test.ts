import { describe, expect, it } from 'vitest';
import {
  buildPrintDefinitionTableHtml,
  buildPrintHtmlTable,
  buildPrintRecordsTableHtml,
  buildPrintTableHtml,
  escapePrintHtml,
  sanitizePrintClassName,
} from './printTableHtml';

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

  it('builds record tables with inferred keys, labels, and numeric alignment', () => {
    const html = buildPrintRecordsTableHtml({
      records: [{ name: 'Sale <A>', total: '120.00' }],
      columnLabels: { name: 'Name', total: 'Total' },
      numericKeys: ['total'],
    });

    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<th class="print-table__cell--end">Total</th>');
    expect(html).toContain('<td>Sale &lt;A&gt;</td>');
    expect(html).toContain('<td class="print-table__cell--end">120.00</td>');
  });

  it('builds definition tables without a header row', () => {
    const html = buildPrintDefinitionTableHtml({
      entries: [{ label: 'Name', value: '<Supplier>' }],
    });

    expect(html).not.toContain('<thead>');
    expect(html).toContain('<td class="print-table__definition-label">Name</td>');
    expect(html).toContain('<td class="print-table__definition-value">&lt;Supplier&gt;</td>');
  });

  it('builds complex html tables with spans and trusted html cells', () => {
    const html = buildPrintHtmlTable({
      tableClassName: 'catalog-table',
      wrapperClassName: null,
      headerRows: [{
        cells: [
          { value: '#', rowSpan: 2, className: 'col-num' },
          { value: 'Days', colSpan: 2, className: 'group-days', style: 'background:#fff;text-align:center;behavior:url(bad)' },
        ],
      }],
      bodyRows: [{
        className: 'cat-header',
        cells: [{ value: 'Category', colSpan: 3 }],
      }, {
        cells: [
          { value: 1, className: 'col-num' },
          { html: '<span class="name-ar">Chicken</span>' },
          { value: '<escaped>' },
        ],
      }],
    });

    expect(html).toContain('<table class="catalog-table">');
    expect(html).toContain('<th class="col-num" rowspan="2">#</th>');
    expect(html).toContain('<th class="group-days" colspan="2" style="background:#fff;text-align:center">Days</th>');
    expect(html).not.toContain('behavior');
    expect(html).toContain('<tr class="cat-header"><td colspan="3">Category</td></tr>');
    expect(html).toContain('<span class="name-ar">Chicken</span>');
    expect(html).toContain('&lt;escaped&gt;');
  });

  it('drops unsafe excessive spans', () => {
    const html = buildPrintHtmlTable({
      wrapperClassName: null,
      bodyRows: [{
        cells: [
          { value: 'Wide', colSpan: 1000 },
          { value: 'Tall', rowSpan: 1000 },
        ],
      }],
    });

    expect(html).toContain('<td>Wide</td>');
    expect(html).toContain('<td>Tall</td>');
    expect(html).not.toContain('colspan="1000"');
    expect(html).not.toContain('rowspan="1000"');
  });
});
