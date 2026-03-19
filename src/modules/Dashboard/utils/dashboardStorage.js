/**
 * تخزين لوحة التحكم — أهداف، أيام خاصة، ملاحظات الأيام
 * مفتاح التخزين يتضمن companyId, year, month للعزل
 */

const TARGET_KEY = 'noorix-dashboard-sales-target';
const SPECIAL_DAYS_KEY = 'noorix-dashboard-special-days';
const DAY_NOTES_KEY = 'noorix-dashboard-day-notes';

function key(prefix, companyId, year, month) {
  return `${prefix}-${companyId}-${year}-${month}`;
}

export function getStoredTargets(companyId, year, month) {
  try {
    const raw = localStorage.getItem(key(TARGET_KEY, companyId, year, month));
    if (!raw) return { overall: null, byDow: {} };
    const parsed = JSON.parse(raw);
    return {
      overall: parsed.overall != null ? parseFloat(parsed.overall) : null,
      byDow: parsed.byDow && typeof parsed.byDow === 'object' ? parsed.byDow : {},
    };
  } catch {
    return { overall: null, byDow: {} };
  }
}

export function setStoredTargets(companyId, year, month, data) {
  try {
    localStorage.setItem(key(TARGET_KEY, companyId, year, month), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function getStoredSpecialDays(companyId, year, month) {
  try {
    const raw = localStorage.getItem(key(SPECIAL_DAYS_KEY, companyId, year, month));
    if (!raw) return [];
    const list = JSON.parse(raw) || [];
    return list.map((item) => {
      if (item.fromDate && item.toDate) return item;
      if (item.dateStr) {
        return {
          id: item.id || `sp-${item.dateStr}`,
          name: item.type === 'holiday' ? 'إجازة' : item.type === 'ramadan' ? 'رمضان' : 'فترة خاصة',
          fromDate: item.dateStr,
          toDate: item.dateStr,
          color: item.color || '#8b5cf6',
        };
      }
      return item;
    });
  } catch {
    return [];
  }
}

export function setStoredSpecialDays(companyId, year, month, days) {
  try {
    localStorage.setItem(key(SPECIAL_DAYS_KEY, companyId, year, month), JSON.stringify(days));
    return true;
  } catch {
    return false;
  }
}

export function getStoredDayNotes(companyId, year, month) {
  try {
    const raw = localStorage.getItem(key(DAY_NOTES_KEY, companyId, year, month));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setStoredDayNotes(companyId, year, month, notes) {
  try {
    localStorage.setItem(key(DAY_NOTES_KEY, companyId, year, month), JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}
