const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function addOrdersV4CalendarDay(value: string): string | null {
  const ymd = value.slice(0, 10);
  const match = YMD.exec(ymd);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** New documents continue the operational sequence; an empty sequence starts today. */
export function suggestOrdersV4DocumentDate(lastDocumentDate: string | null | undefined, todayYmd: string): string {
  return lastDocumentDate ? addOrdersV4CalendarDay(lastDocumentDate) ?? todayYmd : todayYmd;
}
