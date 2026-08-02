import { resolveOrdersV4DocumentListScope } from './orders-v4-document-access.policy';

describe('resolveOrdersV4DocumentListScope', () => {
  it('forces internal-registration staff to their own latest seven Saudi days', () => {
    expect(resolveOrdersV4DocumentListScope({
      canReadAll: false,
      documentType: 'registration',
      requestedStartDate: '2020-01-01',
      requestedEndDate: '2030-01-01',
      userId: 'employee-1',
      todayYmd: '2026-08-03',
    })).toEqual({
      startDate: '2026-07-28',
      endDate: '2026-08-03',
      createdByUserId: 'employee-1',
    });
  });

  it('preserves the manager or owner requested period without a user restriction', () => {
    expect(resolveOrdersV4DocumentListScope({
      canReadAll: true,
      documentType: 'registration',
      requestedStartDate: '2026-01-01',
      requestedEndDate: '2026-12-31',
      userId: 'manager-1',
      todayYmd: '2026-08-03',
    })).toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
  });
});
