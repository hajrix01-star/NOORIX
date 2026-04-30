import { describe, expect, it } from 'vitest';
import {
  prependSavedSlot,
  readSavedSlots,
  removeSavedSlotById,
  savedSlotsStorageKey,
  writeSavedSlots,
} from './costAccountingAppsSavedSlots';

describe('costAccountingAppsSavedSlots', () => {
  const cid = 'test-company-slots';

  it('roundtrips slots for a company key', () => {
    const key = savedSlotsStorageKey(cid);
    localStorage.removeItem(key);
    const slot = {
      id: 'a1',
      savedAt: '2026-01-01T00:00:00.000Z',
      label: 'Test',
      scenarioJson: '{"version":1}\n',
    };
    const next = prependSavedSlot(cid, slot);
    expect(next).toHaveLength(1);
    expect(readSavedSlots(cid)).toEqual(next);
    const after = removeSavedSlotById(cid, 'a1');
    expect(after).toHaveLength(0);
    expect(readSavedSlots(cid)).toEqual([]);
  });

  it('writeSavedSlots truncates to MAX', () => {
    const key = savedSlotsStorageKey(cid);
    localStorage.removeItem(key);
    const many = Array.from({ length: 35 }, (_, i) => ({
      id: `id-${i}`,
      savedAt: new Date().toISOString(),
      label: String(i),
      scenarioJson: `{"version":1,"name":"${i}"}\n`,
    }));
    writeSavedSlots(cid, many);
    expect(readSavedSlots(cid).length).toBeLessThanOrEqual(30);
    localStorage.removeItem(key);
  });
});
