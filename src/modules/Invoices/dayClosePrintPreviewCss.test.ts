import { describe, expect, it } from 'vitest';
import { buildPrintDocumentHtml } from '../../utils/printUtils';
import { DAY_CLOSE_PRINT_PREVIEW_IFRAME_FIX, DAY_CLOSE_REPORT_STYLES } from './components/dayCloseReportStyles';

describe('day close print preview CSS', () => {
  it('keeps central iframe print content visible after legacy modal print rules', () => {
    const html = buildPrintDocumentHtml({
      title: 'Day close',
      body: '<section class="day-close-preview-section"><table class="dc-table"><tbody><tr><td>100</td></tr></tbody></table></section>',
      extraCss: `${DAY_CLOSE_REPORT_STYLES}${DAY_CLOSE_PRINT_PREVIEW_IFRAME_FIX}`,
      autoPrint: false,
    });

    const legacyHideRule = 'body > *:not(.nx-modal-backdrop) { display: none !important; }';
    const iframeShowRule = 'body > *:not(.nx-modal-backdrop) {\n            display: revert !important;';

    expect(html.indexOf(legacyHideRule)).toBeGreaterThan(-1);
    expect(html.indexOf(iframeShowRule)).toBeGreaterThan(html.indexOf(legacyHideRule));
    expect(html).toContain('.day-close-preview-section');
  });
});
