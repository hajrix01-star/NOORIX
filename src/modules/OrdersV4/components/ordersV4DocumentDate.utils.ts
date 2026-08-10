/** Staff choose a business date explicitly: the previous nine days through tomorrow. */
export function ordersV4StaffDocumentDateRange(todayYmd: string): { min: string; max: string } {
  const [year, month, day] = todayYmd.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  start.setUTCDate(start.getUTCDate() - 9);
  const end = new Date(Date.UTC(year, month - 1, day));
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    min: start.toISOString().slice(0, 10),
    max: end.toISOString().slice(0, 10),
  };
}