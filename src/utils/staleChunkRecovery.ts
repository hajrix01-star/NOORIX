/**
 * بعد نشر إصدار جديد، قد يبقى المستخدم على حزمة JS قديمة في الذاكرة/الكاش
 * بينما الملفات على السيرفر بأسماء hash جديدة — فيفشل import() الديناميكي.
 * نعالج ذلك بإعادة تحميل كاملة مرة واحدة (مع علامة في الرابط لتجنب حلقة لا نهائية).
 */
export const STALE_CHUNK_RELOAD_QUERY = 'nxStaleChunk';

export function isStaleViteChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

/** يُرجع true إذا تم طلب إعادة تحميل الصفحة (لا تعرض واجهة الخطأ). */
export function tryRecoverStaleChunkError(error: unknown): boolean {
  if (typeof window === 'undefined') return false;
  if (!isStaleViteChunkLoadError(error)) return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(STALE_CHUNK_RELOAD_QUERY)) return false;
    url.searchParams.set(STALE_CHUNK_RELOAD_QUERY, '1');
    window.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
}

export function hasStaleChunkRecoveryFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(window.location.href).searchParams.has(STALE_CHUNK_RELOAD_QUERY);
  } catch {
    return false;
  }
}
