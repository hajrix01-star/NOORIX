import { describe, expect, it } from 'vitest';
import { resolveOrdersV4RegistrationPresentation } from './ordersV4RegistrationAccess.utils';

describe('resolveOrdersV4RegistrationPresentation', () => {
  it('locks submit-only employees to the latest seven days', () => {
    expect(resolveOrdersV4RegistrationPresentation({
      canCreateRegistration: true,
      canReadAll: false,
      todayYmd: '2026-08-03',
    })).toEqual({
      staffLimited: true,
      startDate: '2026-07-28',
      endDate: '2026-08-03',
    });
  });

  it('does not constrain managers and owners with read access', () => {
    expect(resolveOrdersV4RegistrationPresentation({
      canCreateRegistration: true,
      canReadAll: true,
      todayYmd: '2026-08-03',
    })).toEqual({ staffLimited: false, startDate: '', endDate: '' });
  });
});
