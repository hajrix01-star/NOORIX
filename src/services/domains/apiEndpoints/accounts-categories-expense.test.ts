import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../../core/apiHttp';
import { getAccounts, getExpenseLines } from './accounts-categories-expense';

vi.mock('../../core/apiHttp', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);

describe('accounts and expense-line endpoints', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('preserves account API failures instead of returning an empty successful list', async () => {
    mockedApiGet.mockResolvedValueOnce({ success: false, error: 'accounts failed' });

    await expect(getAccounts('company-1')).resolves.toEqual({
      success: false,
      error: 'accounts failed',
    });
  });

  it('preserves expense-line API failures instead of returning an empty successful list', async () => {
    mockedApiGet.mockResolvedValueOnce({ success: false, error: 'expense lines failed' });

    await expect(getExpenseLines('company-1')).resolves.toEqual({
      success: false,
      error: 'expense lines failed',
    });
  });
});
