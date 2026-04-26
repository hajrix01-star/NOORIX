import { describe, it, expect } from 'vitest';
import * as api from './api';

/**
 * منع regresion بعد تقسيم `domains/apiEndpoints/`: الـ barrel يبقى مصدراً واحداً
 * لكل الدوال المُصدَّرة (عيّنات من وحدات مختلفة).
 */
describe('services/api barrel (apiEndpoints)', () => {
  it('re-exports connection, invoices, and backup', () => {
    expect(typeof api.checkApiConnection).toBe('function');
    expect(typeof api.createInvoice).toBe('function');
    expect(typeof api.getInvoices).toBe('function');
    expect(typeof api.fetchAllInvoicesForExport).toBe('function');
    expect(typeof api.backupTriggerCompany).toBe('function');
    expect(typeof api.backupGetCompanyConfig).toBe('function');
  });

  it('re-exports sales, reports, orders, vaults, and employees', () => {
    expect(typeof api.getDailySalesSummaries).toBe('function');
    expect(typeof api.getGeneralProfitLossReport).toBe('function');
    expect(typeof api.upsertVatPlanning).toBe('function');
    expect(typeof api.getOrders).toBe('function');
    expect(typeof api.getVaults).toBe('function');
    expect(typeof api.getEmployees).toBe('function');
  });
});
