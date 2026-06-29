import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../../core/apiHttp';
import { getRoles } from './companies-ledger-roles';

vi.mock('../../core/apiHttp', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);

describe('roles endpoint', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('preserves role API failures instead of returning an empty successful list', async () => {
    mockedApiGet.mockResolvedValueOnce({ success: false, error: 'roles failed' });

    await expect(getRoles()).resolves.toEqual({
      success: false,
      error: 'roles failed',
    });
  });
});
