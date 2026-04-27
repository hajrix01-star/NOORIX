import { toYmd } from '../../utils/saudiDate';

export function formatAssetDate(iso: unknown): string {
  if (!iso) return '—';
  const s = toYmd(iso);
  return s || '—';
}
