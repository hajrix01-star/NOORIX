import { useEffect, useRef } from 'react';
import { getOcrChatReminders } from '../../OcrInvoices/services/ocrApi';
import type { ChatMessageInput } from '../types';

const ACK_PREFIX = 'noorix-ocr-reminders-ack-';

function loadAckSet(companyId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${ACK_PREFIX}${companyId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveAckSet(companyId: string, ack: Set<string>) {
  try {
    localStorage.setItem(`${ACK_PREFIX}${companyId}`, JSON.stringify([...ack]));
  } catch {
    /* ignore quota errors */
  }
}

export function useOcrChatReminders(
  activeCompanyId: string | undefined,
  addMessage: (msg: ChatMessageInput) => void,
  enabled: boolean,
) {
  const addMessageRef = useRef(addMessage);
  addMessageRef.current = addMessage;

  useEffect(() => {
    if (!activeCompanyId || !enabled) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await getOcrChatReminders();
        if (cancelled || !res.success || !Array.isArray(res.data?.reminders)) return;

        const ack = loadAckSet(activeCompanyId);
        let changed = false;

        for (const row of res.data.reminders) {
          const id = String(row?.id || row?.invoiceId || '').trim();
          if (!id || ack.has(id)) continue;

          const error = String(row?.error || '').slice(0, 240);
          const submitter = row?.submittedByName ? ` (${row.submittedByName})` : '';

          addMessageRef.current({
            role: 'assistant',
            textAr: `⚠️ تذكير OCR: فاتورة لم يُستخرج محتواها${submitter}. المرجع: ${id.slice(0, 8)}…${error ? ` — ${error}` : ''}. راجع OCR → مراجعة الاستخراج أو أعد المحاولة.`,
            textEn: `⚠️ OCR reminder: an invoice could not be extracted${submitter}. Ref: ${id.slice(0, 8)}…${error ? ` — ${error}` : ''}. Open OCR → Extraction review or retry.`,
            extras: { ocrReminder: true, invoiceId: id },
          });

          ack.add(id);
          changed = true;
        }

        if (changed) saveAckSet(activeCompanyId, ack);
      } catch {
        /* silent — chat should not break on reminder poll failure */
      }
    };

    void poll();
    const timer = window.setInterval(() => { void poll(); }, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeCompanyId, enabled]);
}
