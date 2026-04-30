/**
 * لقطات حاسبة التكاليف/التطبيقات — محلية لكل شركة (localStorage).
 */

export type CostAppsSavedSlot = {
  id: string;
  savedAt: string;
  /** عنوان يظهر في الجدول */
  label: string;
  /** نفس بنية ملف JSON للسيناريو (buildCostAppsScenarioFile) */
  scenarioJson: string;
};

const MAX_SLOTS = 30;

export function savedSlotsStorageKey(companyId: string) {
  return `noorix-cost-apps-saved-slots-v1:${companyId}`;
}

export function readSavedSlots(companyId: string): CostAppsSavedSlot[] {
  if (!companyId) return [];
  try {
    const raw = localStorage.getItem(savedSlotsStorageKey(companyId));
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: CostAppsSavedSlot[] = [];
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === 'string' && o.id ? o.id : '';
      const scenarioJson = typeof o.scenarioJson === 'string' ? o.scenarioJson : '';
      if (!id || !scenarioJson.trim()) continue;
      const savedAt = typeof o.savedAt === 'string' && o.savedAt ? o.savedAt : new Date().toISOString();
      const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : '—';
      out.push({ id, savedAt, label, scenarioJson });
    }
    return out;
  } catch {
    return [];
  }
}

export function writeSavedSlots(companyId: string, slots: CostAppsSavedSlot[]): void {
  if (!companyId) return;
  try {
    localStorage.setItem(savedSlotsStorageKey(companyId), JSON.stringify(slots.slice(0, MAX_SLOTS)));
  } catch {
    /* ignore quota */
  }
}

/** يضيف في المقدمة ويُرجع القائمة الجديدة */
export function prependSavedSlot(companyId: string, slot: CostAppsSavedSlot): CostAppsSavedSlot[] {
  const next = [slot, ...readSavedSlots(companyId)].slice(0, MAX_SLOTS);
  writeSavedSlots(companyId, next);
  return next;
}

export function removeSavedSlotById(companyId: string, slotId: string): CostAppsSavedSlot[] {
  const next = readSavedSlots(companyId).filter((s) => s.id !== slotId);
  writeSavedSlots(companyId, next);
  return next;
}
