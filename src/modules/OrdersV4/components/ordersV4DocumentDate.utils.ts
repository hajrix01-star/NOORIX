/** Staff choose a business date explicitly: the previous nine days through tomorrow. */
export function ordersV4StaffDocumentDateRange(todayYmd: string): { min: string; max: string } {
  const start = new Date(`${todayYmd}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 9);
  const end = new Date(`${todayYmd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    min: start.toISOString().slice(0, 10),
    max: end.toISOString().slice(0, 10),
  };
}