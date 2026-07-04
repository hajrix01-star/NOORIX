export type NoorixDateLanguage = 'ar' | 'en' | string;

const MONTH_NAMES_EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localeFor(lang: NoorixDateLanguage) {
  return lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-US';
}

export function getGregorianMonthNames(lang: NoorixDateLanguage, style: 'short' | 'long' = 'short') {
  if (lang !== 'ar' && style === 'short') return MONTH_NAMES_EN_SHORT;

  const formatter = new Intl.DateTimeFormat(localeFor(lang), {
    calendar: 'gregory',
    month: style,
    timeZone: 'Asia/Riyadh',
  });

  return Array.from({ length: 12 }, (_, index) => formatter.format(new Date(Date.UTC(2026, index, 1))));
}

export function getGregorianWeekdayNames(lang: NoorixDateLanguage, style: 'short' | 'long' = 'short') {
  if (lang !== 'ar' && style === 'short') return WEEKDAY_NAMES_EN_SHORT;

  const formatter = new Intl.DateTimeFormat(localeFor(lang), {
    calendar: 'gregory',
    weekday: style,
    timeZone: 'Asia/Riyadh',
  });

  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(Date.UTC(2026, 6, 5 + index))));
}
