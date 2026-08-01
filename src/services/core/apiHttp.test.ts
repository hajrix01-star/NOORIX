import { describe, expect, it } from 'vitest';
import { parseResponse, throwIfApiFailed, unwrapApiList } from './apiHttp';

describe('unwrapApiList', () => {
  it('reads direct arrays', () => {
    expect(unwrapApiList({ success: true, data: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
  });

  it('reads items envelopes', () => {
    expect(unwrapApiList({ success: true, data: { items: [{ id: 'b' }] } })).toEqual([{ id: 'b' }]);
  });

  it('reads nested data envelopes', () => {
    expect(unwrapApiList({ success: true, data: { data: { items: [{ id: 'c' }] } } })).toEqual([{ id: 'c' }]);
  });

  it('throws failed responses', () => {
    expect(() => unwrapApiList({ success: false, error: 'boom' })).toThrow('boom');
  });
});

describe('structured API errors', () => {
  it('preserves the domain error code and details for confirmation flows', async () => {
    const result = await parseResponse(new Response(JSON.stringify({
      message: 'confirmation required',
      errorCode: 'NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED',
      details: { canOverride: true },
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }));

    expect(result).toMatchObject({
      success: false,
      code: 409,
      errorCode: 'NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED',
      details: { canOverride: true },
    });
    try {
      throwIfApiFailed(result);
    } catch (error) {
      expect(error).toMatchObject({
        errorCode: 'NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED',
        details: { canOverride: true },
      });
    }
  });
});
