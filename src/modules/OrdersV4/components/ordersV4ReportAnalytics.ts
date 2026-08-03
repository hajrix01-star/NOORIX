import type { OrdersV4Document, OrdersV4ItemsReportRow, OrdersV4Section } from '../../../types/api';

export type OrdersV4ReportMetric = 'amount' | 'quantity' | 'documents';

export type OrdersV4ReportGroup = {
  id: string;
  label: string;
  documents: number;
  quantity: number;
  amount: number;
};

export type OrdersV4DailyReportRow = OrdersV4ReportGroup & {
  date: string;
  [sectionName: string]: string | number;
};

export type OrdersV4EmployeeReportRow = OrdersV4ReportGroup & { username: string };

export type OrdersV4MissingRegistrationRow = { date: string; sectionId: string; sectionName: string };

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function documentQuantity(document: OrdersV4Document): number {
  return document.lines.reduce((sum, line) => sum + number(line.baseQuantity), 0);
}

function documentAmount(document: OrdersV4Document): number {
  return document.lines.reduce(
    (sum, line) => sum + number(document.documentType === 'registration' ? line.operationalCost : line.lineTotal),
    0,
  );
}

function ymd(value: string): string {
  return String(value || '').slice(0, 10);
}

export function metricValue(row: OrdersV4ReportGroup, metric: OrdersV4ReportMetric): number {
  return metric === 'amount' ? row.amount : metric === 'quantity' ? row.quantity : row.documents;
}

export function aggregateDocumentsBySection(documents: OrdersV4Document[]): OrdersV4ReportGroup[] {
  const groups = new Map<string, OrdersV4ReportGroup>();
  for (const document of documents) {
    const id = document.sectionId || 'unassigned';
    const current = groups.get(id) ?? { id, label: document.section?.nameAr || 'غير محدد', documents: 0, quantity: 0, amount: 0 };
    current.documents += 1;
    current.quantity += documentQuantity(document);
    current.amount += documentAmount(document);
    groups.set(id, current);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

export function aggregateDocumentsByEmployee(documents: OrdersV4Document[]): OrdersV4EmployeeReportRow[] {
  const groups = new Map<string, OrdersV4EmployeeReportRow>();
  for (const document of documents) {
    const user = document.createdByUser;
    const id = user?.id || 'unknown';
    const displayName = String(user?.nameAr || user?.nameEn || user?.username || 'غير محدد').trim();
    const current = groups.get(id) ?? { id, label: displayName, username: String(user?.username || ''), documents: 0, quantity: 0, amount: 0 };
    current.documents += 1;
    current.quantity += documentQuantity(document);
    current.amount += documentAmount(document);
    groups.set(id, current);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

export function aggregateDocumentsByDay(documents: OrdersV4Document[], metric: OrdersV4ReportMetric = 'amount'): OrdersV4DailyReportRow[] {
  const groups = new Map<string, OrdersV4DailyReportRow>();
  for (const document of documents) {
    const date = ymd(document.documentDate);
    const sectionName = document.section?.nameAr || 'غير محدد';
    const current = groups.get(date) ?? { id: date, date, label: date, documents: 0, quantity: 0, amount: 0 };
    const amount = documentAmount(document);
    current.documents += 1;
    current.quantity += documentQuantity(document);
    current.amount += amount;
    current[sectionName] = number(current[sectionName]) + (metric === 'amount' ? amount : metric === 'quantity' ? documentQuantity(document) : 1);
    groups.set(date, current);
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateItems(documents: OrdersV4Document[]): OrdersV4ItemsReportRow[] {
  const groups = new Map<string, { itemId: string; nameAr: string; categoryName: string; inventoryUnit: string; documentIds: Set<string>; quantity: number; amount: number }>();
  for (const document of documents) for (const line of document.lines) {
    const current = groups.get(line.itemId) ?? {
      itemId: line.itemId,
      nameAr: line.itemNameSnapshot,
      categoryName: line.item.category?.nameAr || '',
      inventoryUnit: line.baseUnit.nameAr,
      documentIds: new Set<string>(),
      quantity: 0,
      amount: 0,
    };
    current.documentIds.add(document.id);
    current.quantity += number(line.baseQuantity);
    current.amount += number(document.documentType === 'registration' ? line.operationalCost : line.lineTotal);
    groups.set(line.itemId, current);
  }
  return [...groups.values()].map((row) => ({
    itemId: row.itemId,
    nameAr: row.nameAr,
    categoryName: row.categoryName,
    inventoryUnit: row.inventoryUnit,
    documentCount: row.documentIds.size,
    baseQuantity: String(row.quantity),
    totalAmount: String(row.amount),
    averageUnitCost: String(row.quantity ? row.amount / row.quantity : 0),
  })).sort((a, b) => number(b.totalAmount) - number(a.totalAmount));
}

export function topItemsBySection(documents: OrdersV4Document[], limit = 5): Array<{ sectionId: string; sectionName: string; items: OrdersV4ItemsReportRow[] }> {
  const grouped = new Map<string, { sectionName: string; documents: OrdersV4Document[] }>();
  for (const document of documents) {
    const sectionId = document.sectionId || 'unassigned';
    const current = grouped.get(sectionId) ?? { sectionName: document.section?.nameAr || 'غير محدد', documents: [] };
    current.documents.push(document);
    grouped.set(sectionId, current);
  }
  return [...grouped.entries()].map(([sectionId, group]) => ({
    sectionId,
    sectionName: group.sectionName,
    items: aggregateItems(group.documents).slice(0, limit),
  })).sort((a, b) => a.sectionName.localeCompare(b.sectionName, 'ar'));
}

export function findMissingRegistrationDays(
  documents: OrdersV4Document[],
  sections: OrdersV4Section[],
  startDate: string,
  endDate: string,
): OrdersV4MissingRegistrationRow[] {
  const activeSections = sections.filter((section) => section.isActive);
  if (!startDate || !endDate || activeSections.length === 0) return [];
  const regularDocuments = documents
    .filter((document) => document.status === 'received' && (document.registrationEntryType ?? 'issue') === 'issue' && document.sectionId);
  if (regularDocuments.length === 0) return [];
  const registered = new Set(regularDocuments
    .map((document) => `${ymd(document.documentDate)}:${document.sectionId}`));
  const firstRegistrationDate = regularDocuments.map((document) => ymd(document.documentDate)).sort()[0];
  const effectiveStartDate = firstRegistrationDate > startDate ? firstRegistrationDate : startDate;
  const start = new Date(`${effectiveStartDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const rows: OrdersV4MissingRegistrationRow[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    for (const section of activeSections) if (!registered.has(`${date}:${section.id}`)) rows.push({ date, sectionId: section.id, sectionName: section.nameAr });
  }
  return rows;
}
