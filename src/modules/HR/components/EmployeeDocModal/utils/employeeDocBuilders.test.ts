import { describe, expect, it } from 'vitest';

import { mapReasonByMeta } from './employeeDocBuilders';

describe('employee document termination reason mapping', () => {
  it('maps explicit legal clauses before free text', () => {
    expect(mapReasonByMeta('general termination', 'Article 80')).toBe('article80');
    expect(mapReasonByMeta('general termination', 'Article 81')).toBe('article81');
  });

  it('maps Arabic and English termination reasons for EOS settlement', () => {
    expect(mapReasonByMeta('استقالة الموظف')).toBe('resignation');
    expect(mapReasonByMeta('قوة قاهرة خارجة عن الإرادة')).toBe('force_majeure');
    expect(mapReasonByMeta('استقالة بعد الزواج أو الوضع')).toBe('maternity');
    expect(mapReasonByMeta('employee resignation')).toBe('resignation');
    expect(mapReasonByMeta('force majeure')).toBe('force_majeure');
    expect(mapReasonByMeta('maternity leave case')).toBe('maternity');
  });
});
