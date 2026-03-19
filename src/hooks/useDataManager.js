/**
 * useDataManager — جلب بيانات مرجعية أو إحصائيات مع الكاش المركزي.
 * يُستخدم للبيانات التي تُقرأ كثيراً وتتغير عند المعاملات (موردون، خزائن، إحصائيات).
 * عند أي unifiedTransaction استدعِ invalidateRelated بالمفتاح المناسب لضمان حداثة البيانات.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCache,
  setCache,
  registerRelations,
  invalidateCache,
} from '../utils/cacheHelper';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 دقائق للبيانات المرجعية

/**
 * @param {string} cacheKey - مفتاح الكاش (مثلاً company_1_suppliers أو company_1_stats)
 * @param {() => Promise<{ success: boolean, data?: any }>} fetchFn - دالة جلب من API أو مصدر محلي
 * @param {{ ttlMs?: number, relatedKeys?: string[] }} [opts] - TTL ومفاتيح ذات صلة للإبطال
 * @returns {{ data: any, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useDataManager(cacheKey, fetchFn, opts = {}) {
  const { ttlMs = DEFAULT_TTL_MS, relatedKeys = [] } = opts;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    const cached = getCache(cacheKey);
    if (cached !== undefined) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn();
      if (res.success && res.data !== undefined) {
        setData(res.data);
        setCache(cacheKey, res.data, ttlMs);
        if (relatedKeys.length) {
          registerRelations(cacheKey, relatedKeys);
        }
      } else {
        setError(res.error || 'FETCH_FAILED');
      }
    } catch (e) {
      setError(e.message || 'FETCH_FAILED');
    } finally {
      setLoading(false);
    }
  }, [cacheKey, ttlMs, relatedKeys.length, fetchFn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    invalidateCache(cacheKey);
    fetchData();
  }, [cacheKey, fetchData]);

  return { data, loading, error, refetch };
}

/**
 * بناء مفتاح كاش موحد حسب الشركة والمورد والصفحة.
 */
export function cacheKey(prefix, companyId, ...parts) {
  const safe = (x) => (x == null ? '' : String(x));
  return [prefix, safe(companyId), ...parts.map(safe)].filter(Boolean).join('_');
}
