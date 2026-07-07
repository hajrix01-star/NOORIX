import { describe, expect, it } from 'vitest';
import type { ChatQueryRequest, ChatQueryResponse } from '../../types/api';

describe('chat API contract', () => {
  it('keeps chat responses backend-owned and typed', () => {
    const request: ChatQueryRequest = { query: 'كم المبيعات اليوم؟' };
    const response: ChatQueryResponse = {
      answerAr: 'إجابة',
      answerEn: 'Answer',
      meta: { intentSource: 'keyword', intent: 'sales' },
      extras: {
        chart: {
          kind: 'financeRatios',
          segments: [{ key: 'expenses', pct: 15 }],
        },
      },
    };

    expect(request.query).toContain('المبيعات');
    expect(response.extras?.chart?.kind).toBe('financeRatios');
  });
});
