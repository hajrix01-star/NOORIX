/**
 * useSmartChatUsage — تتبع الاستخدام وترتيب الخيارات بناءً على الأكثر استخداماً
 * يُخزَّن محلياً: noorix-chat-usage-{companyId}-{userId}
 */
import { useCallback, useMemo } from 'react';
import type { PermanentQuestion, PermissionChecker } from '../types';
import { PERMANENT_QUESTIONS } from '../utils/smartChatConstants';
import { filterVisibleFaqQuestions } from '../utils/smartChatGuards';

const STORAGE_PREFIX = 'noorix-chat-usage-';
const MAX_TOP = 6;

function storageKey(companyId: string, userId: string) {
  return `${STORAGE_PREFIX}${companyId}-${userId}`;
}

function loadUsage(companyId: string, userId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(companyId, userId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => {
        const [, value] = entry;
        return typeof value === 'number' && Number.isFinite(value) && value >= 0;
      }),
    );
  } catch {
    return {};
  }
}

function saveUsage(companyId: string, userId: string, usage: Record<string, number>) {
  try {
    localStorage.setItem(storageKey(companyId, userId), JSON.stringify(usage));
  } catch {}
}

export function useSmartChatUsage(companyId: string | undefined, userId: string | undefined) {
  const cid = companyId || '';
  const uid = userId || '';

  const recordUsage = useCallback(
    (key: string) => {
      if (!cid || !uid) return;
      const usage = loadUsage(cid, uid);
      usage[key] = (usage[key] || 0) + 1;
      saveUsage(cid, uid, usage);
    },
    [cid, uid],
  );

  const getSortedQuestions = useCallback(
    (can: PermissionChecker, isAr: boolean): PermanentQuestion[] => {
      const usage = loadUsage(cid, uid);
      const visible = filterVisibleFaqQuestions(PERMANENT_QUESTIONS, can);
      const sorted = [...visible].sort((a, b) => {
        const keyA = a.key;
        const keyB = b.key;
        return (usage[keyB] || 0) - (usage[keyA] || 0);
      });
      return sorted.slice(0, MAX_TOP);
    },
    [cid, uid],
  );

  return { recordUsage, getSortedQuestions };
}
