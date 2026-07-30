import { Prisma } from '@prisma/client';
import { staffItemLineAmount, staffSaleAvgPerOperation, staffSaleAvgPerOrder } from './orders-staff-amount.util';
import { staffSaleOperationKey } from './orders-staff-log-ref.util';
import { staffOrderDayKey } from './orders-staff-date.util';

type StaffSalesReportOrder = {
  id: string;
  logRef: string | null;
  userId: string;
  sectionName: string;
  saleDate?: Date | null;
  createdAt: Date;
  items: Array<{
    productId: string;
    quantity: Prisma.Decimal | number | string | null;
    unit?: string | null;
    size?: string | null;
    packaging?: string | null;
    unitPrice?: Prisma.Decimal | number | string | null;
  }>;
};

type StaffSalesReportUser = {
  id: string;
  email?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

type StaffSalesReportProduct = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  unit?: string | null;
  lastPrice?: Prisma.Decimal | number | string | null;
  variants?: unknown;
};

function staffSalesReportUsername(email?: string | null): string | null {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) return null;
  const separatorIndex = normalizedEmail.indexOf('@');
  return separatorIndex > 0 ? normalizedEmail.slice(0, separatorIndex) : normalizedEmail;
}

export function buildStaffSalesReportModel(params: {
  orders: StaffSalesReportOrder[];
  users: StaffSalesReportUser[];
  products: StaffSalesReportProduct[];
}) {
  const { orders, users, products } = params;
  const userMap = new Map(users.map((u) => [u.id, u]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalQty = 0;
  let totalAmount = new Prisma.Decimal(0);
  const operationKeys = new Set<string>();
  const userOps: Record<string, Set<string>> = {};
  const dayOps: Record<string, Set<string>> = {};
  const byProduct: Record<string, { productId: string; nameAr: string; nameEn: string | null; qty: number; unit: string; sections: Set<string> }> = {};
  const bySection: Record<string, {
    sectionName: string;
    qty: number;
    ordersCount: number;
    totalAmount: Prisma.Decimal;
  }> = {};
  const byUser: Record<string, {
    userId: string;
    username: string | null;
    nameAr: string | null;
    nameEn: string | null;
    ordersCount: number;
    qty: number;
  }> = {};
  const byDay: Record<string, { date: string; ordersCount: number; qty: number }> = {};
  const byLog: Record<string, {
    operationKey: string;
    logRef: string | null;
    date: string;
    userId: string;
    qty: number;
    totalAmount: Prisma.Decimal;
    sections: Set<string>;
  }> = {};

  for (const order of orders) {
    const opKey = staffSaleOperationKey(order);
    operationKeys.add(opKey);
    const day = staffOrderDayKey(order);

    if (!byLog[opKey]) {
      byLog[opKey] = {
        operationKey: opKey,
        logRef: order.logRef,
        date: day,
        userId: order.userId,
        qty: 0,
        totalAmount: new Prisma.Decimal(0),
        sections: new Set(),
      };
    }
    byLog[opKey].sections.add(order.sectionName);

    if (!bySection[order.sectionName]) {
      bySection[order.sectionName] = {
        sectionName: order.sectionName,
        qty: 0,
        ordersCount: 0,
        totalAmount: new Prisma.Decimal(0),
      };
    }
    bySection[order.sectionName].ordersCount++;

    const uid = order.userId;
    const user = userMap.get(uid);
    if (!byUser[uid]) {
      byUser[uid] = {
        userId: uid,
        username: staffSalesReportUsername(user?.email),
        nameAr: user?.nameAr || null,
        nameEn: user?.nameEn || null,
        ordersCount: 0,
        qty: 0,
      };
    }
    if (!userOps[uid]) userOps[uid] = new Set();
    userOps[uid].add(opKey);

    if (!byDay[day]) byDay[day] = { date: day, ordersCount: 0, qty: 0 };
    if (!dayOps[day]) dayOps[day] = new Set();
    dayOps[day].add(opKey);

    for (const item of order.items) {
      const qty = Number(item.quantity);
      const productId = item.productId;
      const product = productMap.get(productId);
      const lineAmount = staffItemLineAmount({ ...item, product });
      totalQty += qty;
      totalAmount = totalAmount.plus(lineAmount);
      bySection[order.sectionName].qty += qty;
      bySection[order.sectionName].totalAmount = bySection[order.sectionName].totalAmount.plus(lineAmount);
      byUser[uid].qty += qty;
      byDay[day].qty += qty;
      byLog[opKey].qty += qty;
      byLog[opKey].totalAmount = byLog[opKey].totalAmount.plus(lineAmount);
      if (!byProduct[productId]) {
        byProduct[productId] = {
          productId,
          nameAr: product?.nameAr || '—',
          nameEn: product?.nameEn || null,
          qty: 0,
          unit: item.unit || product?.unit || '',
          sections: new Set(),
        };
      }
      byProduct[productId].qty += qty;
      byProduct[productId].sections.add(order.sectionName);
    }
  }

  for (const uid of Object.keys(byUser)) {
    byUser[uid].ordersCount = userOps[uid]?.size ?? 0;
  }
  for (const day of Object.keys(byDay)) {
    byDay[day].ordersCount = dayOps[day]?.size ?? 0;
  }

  const byLogRows = Object.values(byLog)
    .map((row) => {
      const user = userMap.get(row.userId);
      const avgPerOrder = staffSaleAvgPerOrder(row.totalAmount, row.qty);
      return {
        operationKey: row.operationKey,
        logRef: row.logRef,
        date: row.date,
        userId: row.userId,
        username: staffSalesReportUsername(user?.email),
        nameAr: user?.nameAr || null,
        nameEn: user?.nameEn || null,
        qty: row.qty,
        totalAmount: Number(row.totalAmount),
        avgPerOrder: Number(avgPerOrder),
        sectionsCount: row.sections.size,
        sections: Array.from(row.sections),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.logRef || '').localeCompare(a.logRef || ''));

  return {
    summary: {
      totalOrders: operationKeys.size,
      totalQty,
      totalAmount: Number(totalAmount),
      avgPerOrder: Number(staffSaleAvgPerOperation(totalAmount, operationKeys.size)),
      uniqueProducts: Object.keys(byProduct).length,
      uniqueSections: Object.keys(bySection).length,
    },
    byProduct: Object.values(byProduct)
      .map((product) => ({ ...product, sections: Array.from(product.sections) }))
      .sort((a, b) => b.qty - a.qty),
    bySection: Object.values(bySection)
      .map((section) => ({
        ...section,
        totalAmount: Number(section.totalAmount),
        averageAmount: Number(staffSaleAvgPerOrder(section.totalAmount, section.qty)),
      }))
      .sort((a, b) => b.qty - a.qty),
    byUser: Object.values(byUser).sort((a, b) => b.qty - a.qty),
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    byLog: byLogRows,
  };
}
