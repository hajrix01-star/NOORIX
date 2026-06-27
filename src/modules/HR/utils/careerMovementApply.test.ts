import { describe, expect, it, vi } from 'vitest';

import { applyCareerRaise, resolveRaiseIncrement } from './careerMovementApply';
import { createMovement, updateEmployee } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  createMovement: vi.fn(),
  updateEmployee: vi.fn(),
}));

describe('careerMovementApply', () => {
  it('resolves raise increment from a target total', () => {
    expect(resolveRaiseIncrement('', '10000', 9500)).toBe(500);
    expect(resolveRaiseIncrement('250', '', 9500)).toBe(250);
  });

  it('applies raises from the central salary package total', async () => {
    vi.mocked(updateEmployee).mockResolvedValue({ success: true, data: {} } as never);
    vi.mocked(createMovement).mockResolvedValue({ success: true, data: {} } as never);

    const result = await applyCareerRaise({
      employee: {
        id: 'emp-1',
        basicSalary: 6000,
        housingAllowance: 1000,
        transportAllowance: 500,
        otherAllowance: 0,
        workHours: '10',
        workSchedule: '[NOORIX_WD:26]',
      },
      companyId: 'co-1',
      customAllowances: [{ employeeId: 'emp-1', amount: '250' }],
      increment: 1000,
      effectiveDate: '2026-07-01',
      notes: 'annual raise',
    });

    expect(result.currentTotalAllIn).toBe(10437.5);
    expect(result.newTarget).toBe(11437.5);
    expect(updateEmployee).toHaveBeenCalledWith('emp-1', { basicSalary: 6727.27 }, 'co-1');
    expect(createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'co-1',
        employeeId: 'emp-1',
        movementType: 'raise',
        amount: 1000,
        previousValue: '10437.5',
        newValue: '11437.5',
      }),
    );
  });
});
