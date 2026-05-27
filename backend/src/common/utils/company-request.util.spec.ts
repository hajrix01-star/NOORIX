import type { Request } from 'express';
import { getCompanyIdFromHttpRequest } from './company-request';

function mockRequest(overrides: Partial<Request> & { method?: string } = {}): Request {
  return {
    method: 'GET',
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  } as Request;
}

describe('getCompanyIdFromHttpRequest', () => {
  const realCompanyId = '11111111-1111-1111-1111-111111111111';
  const entityId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  it('PATCH /orders/:id uses query.companyId, not params.id', () => {
    const req = mockRequest({
      method: 'PATCH',
      params: { id: entityId },
      query: { companyId: realCompanyId },
      body: { items: [] },
    });
    expect(getCompanyIdFromHttpRequest(req)).toBe(realCompanyId);
  });

  it('PATCH /orders/:id uses x-company-id when query is absent', () => {
    const req = mockRequest({
      method: 'PATCH',
      params: { id: entityId },
      body: { items: [] },
      headers: { 'x-company-id': realCompanyId },
    });
    expect(getCompanyIdFromHttpRequest(req)).toBe(realCompanyId);
  });

  it('prefers body.companyId on PATCH', () => {
    const bodyCompany = '22222222-2222-2222-2222-222222222222';
    const req = mockRequest({
      method: 'PATCH',
      params: { id: entityId },
      query: { companyId: realCompanyId },
      body: { companyId: bodyCompany },
    });
    expect(getCompanyIdFromHttpRequest(req)).toBe(bodyCompany);
  });

  it('GET uses query before params.id would (params.id is never used)', () => {
    const req = mockRequest({
      method: 'GET',
      params: { id: entityId },
      query: { companyId: realCompanyId },
    });
    expect(getCompanyIdFromHttpRequest(req)).toBe(realCompanyId);
  });
});
