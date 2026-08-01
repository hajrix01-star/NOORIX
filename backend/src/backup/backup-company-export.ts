/**
 * لقطة منطقية لشركة واحدة — JSON قابل للأرشفة والاسترجاع (تقرير + بيانات).
 * لا يستبدل pg_dump الكامل للقاعدة؛ مكمّل للعزل حسب الشركة.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import type { PrismaService } from '../prisma/prisma.service';

export type CompanySnapshot = {
  meta: {
    format: 'noorix-company-logical';
    version: number;
    exportedAt: string;
    companyId: string;
    tenantId: string;
    attachmentManifestCount?: number;
  };
  /** مسارات مرفقات الفواتير النسبية من جذر التطبيق — يُكمّلها ملف .attachments.tar.gz عند النسخ الاحتياطي */
  attachmentManifest?: { relativePath: string; sizeBytes: number }[];
  counts: Record<string, number>;
  data: Record<string, unknown>;
};

export async function buildCompanyLogicalSnapshot(
  prisma: PrismaService,
  companyId: string,
): Promise<CompanySnapshot> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new Error('COMPANY_NOT_FOUND');
  }
  const where = { companyId };

  const [
    suppliers,
    vaults,
    accounts,
    invoices,
    ledgerEntries,
    auditLogs,
    dailySalesSummaries,
    categories,
    employees,
    payrollRuns,
    leaves,
    leaveSalarySettlements,
    employeeResidencies,
    employeeDocuments,
    employeeMovements,
    employeeCustomAllowances,
    employeeDeductions,
    fiscalPeriods,
    expenseLines,
    orders,
    orderCategories,
    orderSections,
    orderCatalogUnits,
    orderConversionTemplates,
    orderProducts,
    orderItems,
    staffOrders,
    staffOrderItems,
    inventoryStocktakes,
    inventoryStocktakeLines,
    inventoryMovements,
    bankStatements,
    bankStatementCategories,
    bankTreeCategories,
    bankClassificationRules,
    bankStatementTemplates,
    userCompanies,
  ] = await Promise.all([
    prisma.supplier.findMany({ where }),
    prisma.vault.findMany({ where }),
    prisma.account.findMany({ where }),
    prisma.invoice.findMany({ where }),
    prisma.ledgerEntry.findMany({ where }),
    prisma.auditLog.findMany({ where }),
    prisma.dailySalesSummary.findMany({ where }),
    prisma.category.findMany({ where }),
    prisma.employee.findMany({ where }),
    prisma.payrollRun.findMany({ where }),
    prisma.leave.findMany({ where }),
    prisma.leaveSalarySettlement.findMany({ where }),
    prisma.employeeResidency.findMany({ where }),
    prisma.employeeDocument.findMany({ where }),
    prisma.employeeMovement.findMany({ where }),
    prisma.employeeCustomAllowance.findMany({ where }),
    prisma.employeeDeduction.findMany({ where }),
    prisma.fiscalPeriod.findMany({ where }),
    prisma.expenseLine.findMany({ where }),
    prisma.order.findMany({ where }),
    prisma.orderCategory.findMany({ where }),
    prisma.orderSection.findMany({ where }),
    prisma.orderCatalogUnit.findMany({ where }),
    prisma.orderConversionTemplate.findMany({ where }),
    prisma.orderProduct.findMany({ where }),
    prisma.orderItem.findMany({
      where: { order: { companyId } },
    }),
    prisma.staffOrder.findMany({ where }),
    prisma.staffOrderItem.findMany({
      where: { staffOrder: { companyId } },
    }),
    prisma.inventoryStocktake.findMany({ where }),
    prisma.inventoryStocktakeLine.findMany({ where }),
    prisma.inventoryMovement.findMany({ where }),
    prisma.bankStatement.findMany({ where }),
    prisma.bankStatementCategory.findMany({ where }),
    prisma.bankTreeCategory.findMany({ where }),
    prisma.bankClassificationRule.findMany({ where }),
    prisma.bankStatementTemplate.findMany({ where }),
    prisma.userCompany.findMany({ where }),
  ]);

  const statementIds = bankStatements.map((s) => s.id);
  const bankStatementTransactions =
    statementIds.length > 0
      ? await prisma.bankStatementTransaction.findMany({
          where: { statementId: { in: statementIds } },
        })
      : [];

  const summaryIds = dailySalesSummaries.map((s) => s.id);
  const dailySalesChannels =
    summaryIds.length > 0
      ? await prisma.dailySalesChannel.findMany({
          where: { summaryId: { in: summaryIds } },
        })
      : [];

  const payrollRunIds = payrollRuns.map((p) => p.id);
  const payrollRunItems =
    payrollRunIds.length > 0
      ? await prisma.payrollRunItem.findMany({
          where: { payrollRunId: { in: payrollRunIds } },
        })
      : [];
  const payrollItemIds = payrollRunItems.map((i) => i.id);
  const payrollRunItemVaults =
    payrollItemIds.length > 0
      ? await prisma.payrollRunItemVault.findMany({
          where: { payrollItemId: { in: payrollItemIds } },
        })
      : [];
  const payrollRunVaults =
    payrollRunIds.length > 0
      ? await prisma.payrollRunVault.findMany({
          where: { payrollRunId: { in: payrollRunIds } },
        })
      : [];

  const [invoiceVaultAllocations, companyAssets] = await Promise.all([
    prisma.invoiceVaultAllocation.findMany({
      where: { invoice: { companyId } },
    }),
    prisma.companyAsset.findMany({ where }),
  ]);
  const companyAssetIds = companyAssets.map((a) => a.id);
  const companyAssetWarrantyLines =
    companyAssetIds.length > 0
      ? await prisma.companyAssetWarrantyLine.findMany({
          where: { companyAssetId: { in: companyAssetIds } },
        })
      : [];

  const counts: Record<string, number> = {
    suppliers: suppliers.length,
    vaults: vaults.length,
    accounts: accounts.length,
    invoices: invoices.length,
    ledgerEntries: ledgerEntries.length,
    auditLogs: auditLogs.length,
    dailySalesSummaries: dailySalesSummaries.length,
    categories: categories.length,
    employees: employees.length,
    payrollRuns: payrollRuns.length,
    leaves: leaves.length,
    leaveSalarySettlements: leaveSalarySettlements.length,
    employeeResidencies: employeeResidencies.length,
    employeeDocuments: employeeDocuments.length,
    employeeMovements: employeeMovements.length,
    employeeCustomAllowances: employeeCustomAllowances.length,
    employeeDeductions: employeeDeductions.length,
    fiscalPeriods: fiscalPeriods.length,
    expenseLines: expenseLines.length,
    orders: orders.length,
    orderCategories: orderCategories.length,
    orderSections: orderSections.length,
    orderCatalogUnits: orderCatalogUnits.length,
    orderConversionTemplates: orderConversionTemplates.length,
    orderProducts: orderProducts.length,
    orderItems: orderItems.length,
    staffOrders: staffOrders.length,
    staffOrderItems: staffOrderItems.length,
    inventoryStocktakes: inventoryStocktakes.length,
    inventoryStocktakeLines: inventoryStocktakeLines.length,
    inventoryMovements: inventoryMovements.length,
    bankStatements: bankStatements.length,
    bankStatementTransactions: bankStatementTransactions.length,
    bankStatementCategories: bankStatementCategories.length,
    bankTreeCategories: bankTreeCategories.length,
    bankClassificationRules: bankClassificationRules.length,
    bankStatementTemplates: bankStatementTemplates.length,
    userCompanies: userCompanies.length,
    dailySalesChannels: dailySalesChannels.length,
    payrollRunItems: payrollRunItems.length,
    payrollRunItemVaults: payrollRunItemVaults.length,
    payrollRunVaults: payrollRunVaults.length,
    invoiceVaultAllocations: invoiceVaultAllocations.length,
    companyAssets: companyAssets.length,
    companyAssetWarrantyLines: companyAssetWarrantyLines.length,
  };

  const data: Record<string, unknown> = {
    company,
    suppliers,
    vaults,
    accounts,
    invoices,
    ledgerEntries,
    auditLogs,
    dailySalesSummaries,
    categories,
    employees,
    payrollRuns,
    leaves,
    leaveSalarySettlements,
    employeeResidencies,
    employeeDocuments,
    employeeMovements,
    employeeCustomAllowances,
    employeeDeductions,
    fiscalPeriods,
    expenseLines,
    orders,
    orderCategories,
    orderSections,
    orderCatalogUnits,
    orderConversionTemplates,
    orderProducts,
    orderItems,
    staffOrders,
    staffOrderItems,
    inventoryStocktakes,
    inventoryStocktakeLines,
    inventoryMovements,
    bankStatements,
    bankStatementTransactions,
    bankStatementCategories,
    bankTreeCategories,
    bankClassificationRules,
    bankStatementTemplates,
    userCompanies,
    dailySalesChannels,
    payrollRunItems,
    payrollRunItemVaults,
    payrollRunVaults,
    invoiceVaultAllocations,
    companyAssets,
    companyAssetWarrantyLines,
  };

  const cwd = process.cwd();
  const attachmentManifest: { relativePath: string; sizeBytes: number }[] = [];
  for (const inv of invoices as Array<{ attachmentPath?: string | null }>) {
    const ap = inv.attachmentPath;
    if (!ap || typeof ap !== 'string') continue;
    let rel = path.normalize(ap).split(path.sep).join('/');
    if (rel.startsWith('/') || /^[a-z]:/i.test(rel)) continue;
    if (rel.includes('..')) continue;
    const abs = path.join(cwd, rel);
    try {
      const st = await fs.stat(abs);
      if (st.isFile()) attachmentManifest.push({ relativePath: rel, sizeBytes: st.size });
    } catch {
      /* الملف غير موجود على القرص */
    }
  }

  return {
    meta: {
      format: 'noorix-company-logical',
      version: 5,
      exportedAt: new Date().toISOString(),
      companyId,
      tenantId: company.tenantId,
      attachmentManifestCount: attachmentManifest.length,
    },
    counts: {
      ...counts,
      attachmentFiles: attachmentManifest.length,
    },
    ...(attachmentManifest.length > 0 ? { attachmentManifest } : {}),
    data,
  };
}
