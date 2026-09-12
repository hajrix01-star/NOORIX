import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../../core/apiHttp';
import { fetchAllSuppliersForExport } from './suppliers';

vi.mock('../../core/apiHttp', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  throwIfApiFailed: (res: { success?: boolean; error?: string }, fallback = 'طلب فشل') => {
    if (!res?.success) throw new Error(res?.error || fallback);
  },
}));

const mockedApiGet = vi.mocked(apiGet);

describe('fetchAllSuppliersForExport', () => {
  beforeEach(() => mockedApiGet.mockReset());

  it('fetches all pages instead of exporting only the first 200 suppliers', async () => {
    const first = Array.from({ length: 200 }, (_, index) => ({ id: `s-${index}`, nameAr: `مورد ${index}` }));
    mockedApiGet
      .mockResolvedValueOnce({ success: true, data: { items: first, total: 201, page: 1, pageSize: 200 } })
      .mockResolvedValueOnce({ success: true, data: { items: [{ id: 's-200', nameAr: 'المورد الأخير' }], total: 201, page: 2, pageSize: 200 } });

    await expect(fetchAllSuppliersForExport('company-1')).resolves.toHaveLength(201);
    expect(mockedApiGet).toHaveBeenNthCalledWith(1, '/api/v1/suppliers', { companyId: 'company-1', page: '1', pageSize: '200' });
    expect(mockedApiGet).toHaveBeenNthCalledWith(2, '/api/v1/suppliers', { companyId: 'company-1', page: '2', pageSize: '200' });
  });

  it('fails closed when a later page cannot be loaded', async () => {
    mockedApiGet
      .mockResolvedValueOnce({ success: true, data: { items: Array.from({ length: 200 }, (_, index) => ({ id: `s-${index}` })), total: 201 } })
      .mockResolvedValueOnce({ success: false, error: 'تعذر تحميل الصفحة الثانية' });

    await expect(fetchAllSuppliersForExport('company-1')).rejects.toThrow('تعذر تحميل الصفحة الثانية');
  });

  it('does not export a partial result when a page reports an inconsistent total', async () => {
    mockedApiGet
      .mockResolvedValueOnce({ success: true, data: { items: Array.from({ length: 200 }, (_, index) => ({ id: `s-${index}` })), total: 201 } })
      .mockResolvedValueOnce({ success: true, data: { items: [{ id: 's-200' }], total: 202 } });

    await expect(fetchAllSuppliersForExport('company-1')).rejects.toThrow('تغيرت بيانات الموردين أثناء التصدير');
  });
});
