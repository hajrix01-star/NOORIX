/**
 * لقطة منطقية لشركة واحدة — JSON قابل للأرشفة والاسترجاع (تقرير + بيانات).
 * لا يستبدل pg_dump الكامل للقاعدة؛ مكمّل للعزل حسب الشركة.
 */
import type { PrismaService } from '../prisma/prisma.service';

export type CompanySnapshot = {
  meta: {
    format: 'noorix-company-logical';
    version: number;
    exportedAt: string;
    companyId: string;
    tenantId: string;
  };
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
    employeeResidencies,
    employeeDocuments,
    employeeMovements,
    employeeCustomAllowances,
    employeeDeductions,
    fiscalPeriods,
    expenseLines,
    orders,
    orderCategories,
    orderProducts,
    orderItems,
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
    prisma.employeeResidency.findMany({ where }),
    prisma.employeeDocument.findMany({ where }),
    prisma.employeeMovement.findMany({ where }),
    prisma.employeeCustomAllowance.findMany({ where }),
    prisma.employeeDeduction.findMany({ where }),
    prisma.fiscalPeriod.findMany({ where }),
    prisma.expenseLine.findMany({ where }),
    prisma.order.findMany({ where }),
    prisma.orderCategory.findMany({ where }),
    prisma.orderProduct.findMany({ where }),
    prisma.orderItem.findMany({
      where: { order: { companyId } },
    }),
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
    employeeResidencies: employeeResidencies.length,
    employeeDocuments: employeeDocuments.length,
    employeeMovements: employeeMovements.length,
    employeeCustomAllowances: employeeCustomAllowances.length,
    employeeDeductions: employeeDeductions.length,
    fiscalPeriods: fiscalPeriods.length,
    expenseLines: expenseLines.length,
    orders: orders.length,
    orderCategories: orderCategories.length,
    orderProducts: orderProducts.length,
    orderItems: orderItems.length,
    bankStatements: bankStatements.length,
    bankStatementTransactions: bankStatementTransactions.length,
    bankStatementCategories: bankStatementCategories.length,
    bankTreeCategories: bankTreeCategories.length,
    bankClassificationRules: bankClassificationRules.length,
    bankStatementTemplates: bankStatementTemplates.length,
    userCompanies: userCompanies.length,
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
    employeeResidencies,
    employeeDocuments,
    employeeMovements,
    employeeCustomAllowances,
    employeeDeductions,
    fiscalPeriods,
    expenseLines,
    orders,
    orderCategories,
    orderProducts,
    orderItems,
    bankStatements,
    bankStatementTransactions,
    bankStatementCategories,
    bankTreeCategories,
    bankClassificationRules,
    bankStatementTemplates,
    userCompanies,
  };

  return {
    meta: {
      format: 'noorix-company-logical',
      version: 1,
      exportedAt: new Date().toISOString(),
      companyId,
      tenantId: company.tenantId,
    },
    counts,
    data,
  };
}
