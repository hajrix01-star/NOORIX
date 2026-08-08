import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PrintPreviewModal from './PrintPreviewModal';

describe('PrintPreviewModal', () => {
  it('keeps one footer print action and removes the embedded top action', () => {
    render(
      <PrintPreviewModal
        open
        title="Print preview"
        iframeTitle="Report preview"
        html={'<html><body><div class="print-toolbar"><button onclick="window.print()">Top print</button></div><main>Report</main></body></html>'}
        printLabel="Print / PDF"
        closeLabel="Close"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: 'Print / PDF' })).toHaveLength(1);
    const frame = screen.getByTitle('Report preview');
    const srcDoc = frame.getAttribute('srcdoc') || '';
    expect(srcDoc).not.toContain('print-toolbar');
    expect(srcDoc).not.toContain('onclick="window.print()"');
    expect(srcDoc).toContain('<main>Report</main>');
  });
});
