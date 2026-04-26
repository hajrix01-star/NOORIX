/**
 * chatStorage — تخزين المحادثات محلياً
 * المفتاح: noorix-chat-{companyId}
 * القيمة: { creatorName, creatorId, updatedAt, messages }
 */
const PREFIX = 'noorix-chat-';
const MAX_MESSAGES = 500;

function safeStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function key(companyId: any) {
  return `${PREFIX}${companyId || ''}`;
}

export function loadChat(companyId: any) {
  const storage = safeStorage();
  if (!storage || !companyId) return null;
  try {
    const raw = storage.getItem(key(companyId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.messages)) return null;
    const fallbackDate = data.updatedAt || new Date().toISOString();
    data.messages = data.messages.map((m: any) => (m.createdAt ? m : { ...m, createdAt: fallbackDate }));
    if (data.messages.length > MAX_MESSAGES) {
      data.messages = data.messages.slice(-MAX_MESSAGES);
    }
    return data;
  } catch {
    return null;
  }
}

export function saveChat(companyId: any, { creatorName, creatorId, messages }: any) {
  const storage = safeStorage();
  if (!storage || !companyId) return;
  try {
    const trimmed = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
    const data = {
      creatorName: creatorName || '',
      creatorId: creatorId || '',
      updatedAt: new Date().toISOString(),
      messages: trimmed,
    };
    storage.setItem(key(companyId), JSON.stringify(data));
  } catch (_: any) {}
}

export function filterByDate(messages: any, dateStr: any) {
  if (!dateStr || !messages?.length) return messages;
  const target = dateStr.slice(0, 10);
  return messages.filter((m: any) => {
    const d = m.createdAt ? String(m.createdAt).slice(0, 10) : '';
    return d === target;
  });
}
