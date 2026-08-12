import { ForbiddenException } from '@nestjs/common';
import { CompanyController } from './company.controller';
import type { CompanyService } from './company.service';

describe('CompanyController tax settings permissions', () => {
  const update = jest.fn();
  const controller = new CompanyController({ update } as unknown as CompanyService);

  beforeEach(() => {
    update.mockReset();
    update.mockResolvedValue({ id: 'company-1' });
  });

  it.each(['MANAGE_TAX_SETTINGS', 'MANAGE_SETTINGS'])(
    'allows the tax settings tab contract for %s',
    async (permission) => {
      await controller.update(
        'company-1',
        { vatEnabledForSales: true, vatRatePercent: 15 },
        { user: { role: 'accountant', permissions: [permission] } },
      );

      expect(update).toHaveBeenCalledWith(
        'company-1',
        expect.objectContaining({ vatEnabledForSales: true, vatRatePercent: 15 }),
      );
    },
  );

  it('does not let company-management permission silently grant tax management', async () => {
    await expect(
      controller.update(
        'company-1',
        { vatRatePercent: 15 },
        { user: { role: 'accountant', permissions: ['MANAGE_COMPANIES'] } },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
