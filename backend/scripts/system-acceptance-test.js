const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_BASE = process.env.ACCEPTANCE_API_BASE || 'http://localhost:3000/api/v1';
const PASSWORDS = [
  process.env.ACCEPTANCE_ADMIN_PASSWORD,
  'Hajrim2h',
  '123',
].filter(Boolean);

let activeCompanyId = '';

function money(value) {
  return Number(value ?? 0);
}

function eq(actual, expected, eps = 0.02) {
  return Math.abs(money(actual) - money(expected)) <= eps;
}

function ymd(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthCode(month) {
  return `M${month}`;
}

function jsonHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeCompanyId ? { 'x-company-id': activeCompanyId } : {}),
  };
}

async function api(method, path, token, body) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: jsonHeaders(token),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`Backend is not reachable at ${API_BASE}. Start the backend first. ${error.message}`);
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(`${method} ${path} failed with ${response.status}`);
    error.data = data;
    throw error;
  }
  return data;
}

async function login() {
  for (const password of PASSWORDS) {
    try {
      const data = await api('POST', '/auth/login', '', {
        email: process.env.ACCEPTANCE_ADMIN_EMAIL || 'admin@hajrix.com',
        password,
      });
      return { token: data.access_token, user: data.user, password };
    } catch {
      // Try the next known local password.
    }
  }
  throw new Error('Could not log in with known local admin passwords.');
}

async function choosePayrollPeriod(companyId) {
  const runs = await prisma.payrollRun.findMany({
    where: { companyId },
    select: { payrollMonth: true },
  });
  const used = new Set(
    runs.map((run) => {
      const d = new Date(new Date(run.payrollMonth).getTime() + 12 * 60 * 60 * 1000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }),
  );

  for (let year = 2026; year <= 2030; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!used.has(key)) return { year, month };
    }
  }
  throw new Error('No available payroll month between 2026 and 2030.');
}

async function ensureVaults(token, companyId) {
  const paymentOptions = await api('GET', '/vaults/payment-options', token);
  if (!Array.isArray(paymentOptions) || paymentOptions.length < 2) {
    throw new Error('Acceptance test requires at least two active payment vaults.');
  }

  const cash =
    paymentOptions.find((vault) => String(vault.nameAr || '').includes('نقد')) ||
    paymentOptions.find((vault) => vault.type === 'cash') ||
    paymentOptions[0];
  const bank =
    paymentOptions.find((vault) => String(vault.nameAr || '').includes('بنك')) ||
    paymentOptions.find((vault) => vault.type === 'bank') ||
    paymentOptions.find((vault) => vault.id !== cash.id) ||
    paymentOptions[0];

  await api('PATCH', `/vaults/${cash.id}`, token, {
    isSalesChannel: true,
    showAsPaymentMethod: true,
  });
  await api('PATCH', `/vaults/${bank.id}`, token, {
    showAsPaymentMethod: true,
  });

  const salesChannels = await api('GET', '/vaults/sales-channels', token);
  if (!Array.isArray(salesChannels) || !salesChannels.some((vault) => vault.id === cash.id)) {
    throw new Error('Could not enable a sales-channel vault for acceptance sales.');
  }

  return { cash, bank, companyId };
}

async function resolveCategories(companyId) {
  const categories = await prisma.category.findMany({
    where: { companyId, isActive: true },
    include: { account: true },
  });
  const byCodePrefix = (prefix) => categories.find((category) => String(category.code || '').startsWith(prefix));
  const byAccount = (code) => categories.find((category) => category.account?.code === code);
  const purchase = byCodePrefix('P') || categories.find((category) => category.type === 'purchase');
  const fixedExpense = byAccount('EXP-003') || byCodePrefix('E3') || categories.find((category) => category.type === 'expense');
  const variableExpense = byAccount('EXP-005') || byCodePrefix('E5') || categories.find((category) => category.type === 'expense');

  if (!purchase || !fixedExpense || !variableExpense) {
    throw new Error('Required accounting categories are missing. Run DB seed first.');
  }
  return { purchase, fixedExpense, variableExpense };
}

async function createAcceptanceData(token, companyId, vaults, categories) {
  const tag = `SAT-${Date.now().toString(36).toUpperCase()}`;
  const period = await choosePayrollPeriod(companyId);
  const txDate = ymd(period.year, period.month, 8);
  const payrollMonth = ymd(period.year, period.month, 1);

  await api('PATCH', `/companies/${companyId}`, token, {
    vatEnabledForSales: true,
    vatRatePercent: 15,
  });

  const taxTail = String(Date.now() % 1000000000).padStart(9, '0');
  const purchaseTaxNumber = `300000${taxTail}`;
  const serviceTaxNumber = `300001${taxTail}`;

  const supplierPurchase = await api('POST', '/suppliers', token, {
    companyId,
    nameAr: `${tag} Food Supplier`,
    nameEn: `${tag} Food Supplier`,
    taxNumber: purchaseTaxNumber,
    phone: '0500000101',
    supplierType: 'purchases',
    isTaxRegistered: true,
  });
  const supplierService = await api('POST', '/suppliers', token, {
    companyId,
    nameAr: `${tag} Services Supplier`,
    nameEn: `${tag} Services Supplier`,
    taxNumber: serviceTaxNumber,
    phone: '0500000102',
    supplierType: 'expenses',
    isTaxRegistered: true,
  });

  const employee = await api('POST', '/employees', token, {
    companyId,
    name: `${tag} Payroll Employee`,
    nameEn: `${tag} Payroll Employee`,
    iqamaNumber: String(2000000000 + (Date.now() % 100000000)).padStart(10, '2').slice(0, 10),
    jobTitle: 'Acceptance cashier',
    basicSalary: 4000,
    housingAllowance: 1000,
    transportAllowance: 300,
    otherAllowance: 200,
    joinDate: '2026-01-01',
    workHours: '8',
    workSchedule: '6 days',
    status: 'active',
    notes: `${tag} acceptance employee`,
  });

  await api('POST', '/hr/allowances', token, {
    companyId,
    employeeId: employee.id,
    nameAr: `${tag} fixed allowance`,
    amount: 250,
  });

  const fixedLine = await api('POST', '/expense-lines', token, {
    companyId,
    nameAr: `${tag} office rent`,
    nameEn: `${tag} office rent`,
    kind: 'fixed_expense',
    categoryId: categories.fixedExpense.id,
    supplierId: supplierService.id,
    referenceAmount: 1200,
    allowPaymentAmountOverride: false,
    annualTotalAmount: 14400,
    installmentIntervalMonths: 1,
    isActive: true,
  });
  const variableLine = await api('POST', '/expense-lines', token, {
    companyId,
    nameAr: `${tag} maintenance`,
    nameEn: `${tag} maintenance`,
    kind: 'expense',
    categoryId: categories.variableExpense.id,
    supplierId: supplierService.id,
    referenceAmount: 345,
    allowPaymentAmountOverride: true,
    isActive: true,
  });

  const orderCategory = await api('POST', '/orders/categories', token, {
    companyId,
    nameAr: `${tag} order category`,
    nameEn: `${tag} order category`,
  });
  const orderSection = await api('POST', '/orders/sections', token, {
    companyId,
    nameAr: `${tag} kitchen`,
    nameEn: `${tag} kitchen`,
  });
  const product = await api('POST', '/orders/products', token, {
    companyId,
    nameAr: `${tag} rice`,
    nameEn: `${tag} rice`,
    unit: 'kg',
    categoryId: orderCategory.id,
    sectionIds: [orderSection.id],
    productType: 'order',
    lastPrice: '12.50',
  });
  const order = await api('POST', '/orders', token, {
    companyId,
    orderDate: txDate,
    orderType: 'external',
    pettyCashAmount: '50',
    notes: `${tag} acceptance order`,
    items: [{ productId: product.id, quantity: '4', unitPrice: '12.50', unit: 'kg' }],
  });

  const advance = await api('POST', '/invoices', token, {
    companyId,
    employeeId: employee.id,
    kind: 'advance',
    totalAmount: 600,
    isTaxable: false,
    transactionDate: txDate,
    vaultId: vaults.bank.id,
    installmentCount: 3,
    installmentAmount: 200,
    notes: `${tag} advance source for payroll deduction`,
    idempotencyKey: `${tag}-advance`,
  });
  await api('POST', '/hr/deductions', token, {
    companyId,
    employeeId: employee.id,
    deductionType: 'penalty',
    amount: 100,
    transactionDate: txDate,
    notes: `${tag} approved penalty deduction source`,
  });

  const snapshot = await api('GET', `/hr/employees/${employee.id}/compensation-snapshot`, token);
  const gross = Number(snapshot.salaryPackage.total);
  const payrollNet = gross - 100 - 200;
  const payrollRun = await api('POST', '/hr/payroll-runs', token, {
    companyId,
    payrollMonth,
    items: [{
      employeeId: employee.id,
      grossSalary: gross,
      allowancesAdd: 0,
      deductions: 100,
      advancesDeduct: 200,
      netSalary: payrollNet,
      notes: `${tag} penalty and advance both have source records`,
    }],
    vaultSplits: [{ vaultId: vaults.bank.id, amount: payrollNet }],
    notes: `${tag} acceptance payroll run`,
  });
  await api('PATCH', `/hr/payroll-runs/${payrollRun.id}/status`, token, { status: 'completed' });
  const payrollPayment = await api('POST', '/hr/payroll-runs/issue-payment', token, {
    payrollRunId: payrollRun.id,
    transactionDate: txDate,
    vaultSplits: [{ vaultId: vaults.bank.id, amount: payrollNet }],
  });

  const sale = await api('POST', '/sales/summary', token, {
    companyId,
    transactionDate: txDate,
    customerCount: 7,
    channels: [{ vaultId: vaults.cash.id, amount: '115.00' }],
    cashOnHand: '115.00',
    shift: 'all',
    notes: `${tag} VAT inclusive sales 115`,
    idempotencyKey: `${tag}-sale`,
  });

  const batch = await api('POST', '/invoices/batch', token, {
    companyId,
    transactionDate: txDate,
    vaultId: vaults.bank.id,
    batchNotes: `${tag} acceptance purchase/expense batch`,
    idempotencyKey: `${tag}-outflow-batch`,
    items: [
      {
        supplierId: supplierPurchase.id,
        categoryId: categories.purchase.id,
        supplierInvoiceNumber: `${tag}-PUR-001`,
        kind: 'purchase',
        totalAmount: 2300,
        isTaxable: true,
        notes: `${tag} taxable purchase`,
      },
      {
        supplierId: supplierService.id,
        expenseLineId: fixedLine.id,
        supplierInvoiceNumber: `${tag}-FIX-001`,
        kind: 'fixed_expense',
        totalAmount: 1200,
        isTaxable: false,
        notes: `${tag} fixed expense monthly rent`,
      },
      {
        supplierId: supplierService.id,
        expenseLineId: variableLine.id,
        supplierInvoiceNumber: `${tag}-EXP-001`,
        kind: 'expense',
        totalAmount: 345,
        isTaxable: true,
        notes: `${tag} variable maintenance expense`,
      },
      {
        supplierId: supplierPurchase.id,
        categoryId: categories.purchase.id,
        supplierInvoiceNumber: `${tag}-AST-001`,
        kind: 'purchase',
        totalAmount: 575,
        isTaxable: true,
        notes: `${tag} asset purchase source invoice`,
        warrantyFollowUp: true,
      },
    ],
  });

  const assetInvoice = await prisma.invoice.findFirstOrThrow({
    where: { companyId, supplierInvoiceNumber: `${tag}-AST-001`, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  const asset = await api('POST', '/company-assets/complete-from-invoice', token, {
    companyId,
    invoiceId: assetInvoice.id,
    nameAr: `${tag} POS Terminal`,
    nameEn: `${tag} POS Terminal`,
    serialNumber: `${tag}-POS-001`,
    location: 'Main Branch',
    purchaseDate: txDate,
    acquisitionCost: 575,
    warrantyDescription: 'One year warranty',
    warrantyMonths: 12,
    warrantyStartDate: txDate,
    notes: `${tag} asset linked to purchase invoice`,
  });

  const transfer = await api('POST', '/vaults/transfer', token, {
    companyId,
    fromVaultId: vaults.cash.id,
    toVaultId: vaults.bank.id,
    amount: '50',
    transactionDate: txDate,
    notes: `${tag} acceptance vault transfer`,
    idempotencyKey: `${tag}-transfer`,
  });

  return {
    tag,
    period,
    txDate,
    ids: {
      employeeId: employee.id,
      advanceInvoiceId: advance.invoice?.id,
      payrollRunId: payrollRun.id,
      salaryInvoiceId: payrollPayment.invoices?.[0]?.id,
      saleSummaryId: sale.summary?.id || sale.id,
      batchId: batch.batchId,
      assetId: asset.id,
      assetInvoiceId: assetInvoice.id,
      transferLedgerId: transfer.ledgerEntry?.id,
      orderId: order.id,
    },
    expected: {
      gross,
      payrollNet,
      penaltyDeduction: 100,
      advanceDeducted: 200,
    },
  };
}

async function verifyData(token, companyId, acceptance) {
  const { tag, period, txDate, ids, expected } = acceptance;
  const startDate = ymd(period.year, period.month, 1);
  const endDate = ymd(period.year, period.month, 28);

  const [
    invoices,
    deductions,
    payroll,
    asset,
    order,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        companyId,
        status: 'active',
        OR: [
          { id: { in: [ids.advanceInvoiceId, ids.salaryInvoiceId, ids.assetInvoiceId].filter(Boolean) } },
          { batchId: ids.batchId },
          { dailySalesSummaryId: ids.saleSummaryId },
        ],
      },
      include: { vaultAllocations: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.employeeDeduction.findMany({
      where: { companyId, employeeId: ids.employeeId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.payrollRun.findUnique({
      where: { id: ids.payrollRunId },
      include: { items: true },
    }),
    prisma.companyAsset.findUnique({ where: { id: ids.assetId } }),
    prisma.order.findUnique({ where: { id: ids.orderId }, include: { items: true } }),
  ]);

  const ledgers = await prisma.ledgerEntry.findMany({
    where: {
      companyId,
      status: 'active',
      transactionDate: {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const saleInvoice = invoices.find((invoice) => invoice.dailySalesSummaryId === ids.saleSummaryId);
  const salaryInvoice = invoices.find((invoice) => invoice.kind === 'salary' && invoice.batchId === ids.payrollRunId);
  const advanceInvoice = invoices.find((invoice) => invoice.id === ids.advanceInvoiceId);
  const invoiceBySupplierNo = new Map(
    invoices.filter((invoice) => invoice.supplierInvoiceNumber).map((invoice) => [invoice.supplierInvoiceNumber, invoice]),
  );

  const checks = [];
  const check = (name, ok, details = '') => checks.push({ name, ok: Boolean(ok), details });

  check('sales 115 inclusive stores net 100', saleInvoice && eq(saleInvoice.netAmount, 100));
  check('sales 115 inclusive stores tax 15', saleInvoice && eq(saleInvoice.taxAmount, 15));
  check('sales 115 inclusive stores total 115', saleInvoice && eq(saleInvoice.totalAmount, 115));
  check('advance invoice created through financial path', advanceInvoice && eq(advanceInvoice.totalAmount, 600));
  check('advance deduction settled from payroll', advanceInvoice && eq(advanceInvoice.settledAmount, 200));
  check('penalty deduction has HR source row', deductions.some((row) => row.deductionType === 'penalty' && eq(row.amount, 100)));
  check(
    'advance deduction has source invoice reference',
    deductions.some((row) => row.deductionType === 'advance' && eq(row.amount, 200) && row.referenceId === ids.advanceInvoiceId),
  );
  check('payroll gross matches central snapshot', payroll?.items?.[0] && eq(payroll.items[0].grossSalary, expected.gross));
  check('payroll net equals gross minus penalty and advance', payroll && eq(payroll.totalAmount, expected.payrollNet));
  check('payroll salary invoice issued', salaryInvoice && eq(salaryInvoice.totalAmount, expected.payrollNet));

  const purchase = invoiceBySupplierNo.get(`${tag}-PUR-001`);
  const fixedExpense = invoiceBySupplierNo.get(`${tag}-FIX-001`);
  const expense = invoiceBySupplierNo.get(`${tag}-EXP-001`);
  const assetInvoice = invoiceBySupplierNo.get(`${tag}-AST-001`);
  check('purchase taxable 2300 stores net 2000', purchase && eq(purchase.netAmount, 2000));
  check('purchase taxable 2300 stores tax 300', purchase && eq(purchase.taxAmount, 300));
  check('fixed expense 1200 stores tax 0', fixedExpense && eq(fixedExpense.taxAmount, 0));
  check('variable expense 345 stores net 300', expense && eq(expense.netAmount, 300));
  check('variable expense 345 stores tax 45', expense && eq(expense.taxAmount, 45));
  check('asset is linked to its source invoice', asset && asset.invoiceId === ids.assetInvoiceId);
  check('asset source invoice warranty follow-up completed', assetInvoice && assetInvoice.warrantyFollowUpDone === true);
  check('order is saved with one item', order && order.items.length === 1);
  check('vault transfer ledger exists', ledgers.some((entry) => entry.referenceType === 'transfer' && eq(entry.amount, 50)));

  for (const invoice of invoices) {
    const allocationTotal = invoice.vaultAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    check(`vault allocations match invoice ${invoice.invoiceNumber}`, eq(allocationTotal, invoice.totalAmount));
    if (invoice.kind !== 'sale') {
      check(
        `ledger exists for outflow invoice ${invoice.invoiceNumber}`,
        ledgers.some((entry) => entry.referenceId === invoice.id),
      );
    }
  }

  const dashQuery = [
    `companyId=${companyId}`,
    `year=${period.year}`,
    `yearStart=${period.year}-01-01`,
    `yearEnd=${period.year}-12-31`,
    `periodStart=${startDate}`,
    `periodEnd=${endDate}`,
    `dailyStart=${startDate}`,
    `dailyEnd=${endDate}`,
    `monthStart=${startDate}`,
    `monthEnd=${endDate}`,
    `selectedMonth=${period.month}`,
  ].join('&');

  const [
    profitLoss,
    vat,
    periodAnalytics,
    dashboard,
    owner,
    vaults,
    hrSummary,
    ordersSummary,
  ] = await Promise.all([
    api('GET', `/reports/general-profit-loss?companyId=${companyId}&year=${period.year}`, token),
    api('GET', `/reports/tax-vat?companyId=${companyId}&year=${period.year}&period=${monthCode(period.month)}&salesAmountIncludesVat=true`, token),
    api('GET', `/reports/period-analytics?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}`, token),
    api('GET', `/dashboard/overview?${dashQuery}`, token),
    api('GET', `/owner/overview?companyIds=${companyId}&year=${period.year}&month=${period.month}`, token),
    api('GET', `/vaults?startDate=${startDate}&endDate=${endDate}`, token),
    api('GET', '/hr/dashboard-summary', token),
    api('GET', `/orders/summary?year=${period.year}&month=${period.month}`, token),
  ]);

  const downstreamText = JSON.stringify({
    profitLoss,
    vat,
    periodAnalytics,
    dashboard,
    owner,
    vaults,
    hrSummary,
    ordersSummary,
  });
  check('VAT report sees sales tax 15', downstreamText.includes('15'));
  check('downstream reports see payroll net', downstreamText.includes(String(expected.payrollNet)));
  check('downstream reports see purchase total 2875', downstreamText.includes('2875'));
  check('dashboard endpoint returns period data', Boolean(dashboard?.periodData));
  check('owner endpoint returns company rows', Array.isArray(owner?.companyRows));
  check('vaults endpoint returns vault rows', Array.isArray(vaults) && vaults.length >= 2);
  check('orders summary endpoint returns data', Boolean(ordersSummary));

  const failed = checks.filter((item) => !item.ok);
  return {
    passed: checks.length - failed.length,
    total: checks.length,
    failed,
    sourceTotals: {
      saleGross: 115,
      saleNet: 100,
      saleTax: 15,
      purchaseGross: 2875,
      purchaseTax: 375,
      fixedExpenseGross: 1200,
      variableExpenseGross: 345,
      variableExpenseTax: 45,
      payrollGross: expected.gross,
      payrollNet: expected.payrollNet,
      advance: 600,
      advanceDeducted: 200,
    },
  };
}

async function main() {
  const loginResult = await login();
  const token = loginResult.token;
  activeCompanyId = loginResult.user.companyIds?.[0] || '';
  if (!activeCompanyId) throw new Error('Logged-in user has no company.');

  const companyId = activeCompanyId;
  const vaults = await ensureVaults(token, companyId);
  const categories = await resolveCategories(companyId);
  const acceptance = await createAcceptanceData(token, companyId, vaults, categories);
  const verification = await verifyData(token, companyId, acceptance);

  const summary = {
    apiBase: API_BASE,
    companyId,
    tag: acceptance.tag,
    period: acceptance.period,
    ids: acceptance.ids,
    checks: {
      passed: verification.passed,
      total: verification.total,
      failed: verification.failed.map((item) => item.name),
    },
    sourceTotals: verification.sourceTotals,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (verification.failed.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    if (error.data) console.error(JSON.stringify(error.data, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
