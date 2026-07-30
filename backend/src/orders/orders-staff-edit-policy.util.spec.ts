import {
  canEditStaffSaleRecordByLatest,
  isPrivilegedStaffOrderRole,
  staffSaleEditScopeKey,
} from './orders-staff-edit-policy.util';

describe('orders staff edit policy', () => {
  it('uses logRef as the edit scope when available', () => {
    expect(staffSaleEditScopeKey({ id: 'one', logRef: ' DS-001 ' })).toBe('DS-001');
    expect(staffSaleEditScopeKey({ id: 'one', logRef: null })).toBe('one');
  });

  it('allows owners and super admins to bypass the latest-record restriction', () => {
    expect(isPrivilegedStaffOrderRole('owner')).toBe(true);
    expect(isPrivilegedStaffOrderRole('super_admin')).toBe(true);
    expect(isPrivilegedStaffOrderRole('cashier')).toBe(false);
  });

  it('allows non-owners to edit only the latest internal log scope', () => {
    const target = { id: 'old-section', logRef: 'DS-001' };
    const latestSameLog = { id: 'latest-section', logRef: 'DS-001' };
    const latestDifferentLog = { id: 'latest-section', logRef: 'DS-002' };

    expect(canEditStaffSaleRecordByLatest({ target, latest: latestSameLog, role: 'cashier' })).toBe(true);
    expect(canEditStaffSaleRecordByLatest({ target, latest: latestDifferentLog, role: 'cashier' })).toBe(false);
    expect(canEditStaffSaleRecordByLatest({ target, latest: latestDifferentLog, role: 'owner' })).toBe(true);
  });
});
