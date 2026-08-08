const EMBEDDED_PRINT_TOOLBAR_PATTERN = /<div\b[^>]*\bclass=(["'])[^"']*\bprint-toolbar\b[^"']*\1[^>]*>[\s\S]*?<\/div>\s*/gi;

/**
 * PrintPreviewModal owns the single print action in its footer. Remove the
 * standalone-document toolbar before rendering the document inside its iframe.
 */
export function removeEmbeddedPrintToolbar(html: string): string {
  return String(html || '').replace(EMBEDDED_PRINT_TOOLBAR_PATTERN, '');
}
