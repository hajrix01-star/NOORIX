export const CONFIDENCE_COLOR = (c: any) => {
  if (c >= 0.9) return 'var(--noorix-accent-green)';
  if (c >= 0.7) return 'var(--noorix-accent-amber)';
  return 'var(--noorix-accent-red)';
};

export const STATUS_BADGE = {
  auto: { bg: '#dcfce7', color: 'var(--noorix-accent-green)', label: { ar: 'تلقائي', en: 'Auto' } },
  review: { bg: '#fef3c7', color: 'var(--noorix-accent-amber)', label: { ar: 'راجع', en: 'Review' } },
  new: { bg: '#fee2e2', color: 'var(--noorix-accent-red)', label: { ar: 'جديد', en: 'New' } },
};

export function revokePreviewUrl(url: any) {
  if (url && String(url).startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}
