import { toYmd } from '../../../utils/saudiDate';

export function esc(v: unknown) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function n(v: unknown) {
  const x = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(x) ? x : 0;
}

export function defaultPeriodLabel(lang: unknown) {
  return new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' });
}

export function monthNameAr(m1to12: number) {
  return new Date(2000, m1to12 - 1, 1).toLocaleDateString('ar-SA', { month: 'long' });
}

/** Arabic month names (Jan–Dec) for annual payroll month toggles in the print tab. */
export const HR_MONTH_LABELS_AR: readonly string[] = Array.from({ length: 12 }, (_, i) => monthNameAr(i + 1));

export function monthNameEn(m1to12: number) {
  return new Date(2000, m1to12 - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

export function parseYmd(d: unknown) {
  if (!d || typeof d !== 'string') return null;
  const x = new Date(`${toYmd(d)}T12:00:00`);
  return Number.isNaN(x.getTime()) ? null : x;
}

export function formatDateLocale(d: unknown, loc: string) {
  const p = parseYmd(d);
  if (!p) return '—';
  return p.toLocaleDateString(loc, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function serviceDurationArEn(startStr: unknown, endStr: unknown) {
  const a = parseYmd(startStr);
  const b = parseYmd(endStr);
  if (!a || !b || b < a) return { ar: '—', en: '—' };
  const days = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
  const mo = Math.floor(days / 30);
  const da = days % 30;
  return { ar: `${mo} شهر و ${da} يوم`, en: `${mo} month(s) and ${da} day(s)` };
}

export function firstLastActiveMonthRange(monthOn: boolean[], year: number) {
  let fi = -1;
  let li = -1;
  monthOn.forEach((on, i) => {
    if (on) {
      if (fi < 0) fi = i;
      li = i;
    }
  });
  if (fi < 0) return null;
  return {
    ar: `${monthNameAr(fi + 1)}–${monthNameAr(li + 1)} ${year}`,
    en: `${monthNameEn(fi + 1)}–${monthNameEn(li + 1)} ${year}`,
  };
}
