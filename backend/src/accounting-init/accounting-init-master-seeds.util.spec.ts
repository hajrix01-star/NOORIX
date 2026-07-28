import {
  MASTER_SUBCATEGORIES,
  MASTER_SUPPLIERS,
} from './accounting-init-master-seeds.util';

describe('accounting initialization master seeds', () => {
  it('seeds the approved government categories without taking over E2-9', () => {
    const byCode = new Map(MASTER_SUBCATEGORIES.map((entry) => [entry.code, entry]));
    expect(byCode.get('E2-8')?.nameAr).toBe('GOSI');
    expect(byCode.get('E2-10')?.nameAr).toBe('رسوم منصات حكومية');
    expect(byCode.get('E2-11')?.nameAr).toBe('شهادات صحية وتصاريح موظفين');
    expect(byCode.has('E2-9')).toBe(false);
  });

  it('links default service suppliers to stable directory codes', () => {
    expect(MASTER_SUPPLIERS).toEqual(expect.arrayContaining([
      expect.objectContaining({ directoryCode: 'UTL-SA-ENERGY' }),
      expect.objectContaining({ directoryCode: 'TEL-STC' }),
    ]));
  });
});
