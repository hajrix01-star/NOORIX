/**
 * مصدر واحد لسلسلة JWT (توقيع + تحقق) — لا تكرر الـ fallback في عدة ملفات.
 * الإنتاج: يجب تعيين JWT_SECRET في البيئة (راجع main.ts / AuthModule).
 */
export const JWT_DEV_FALLBACK = 'noorix-dev-secret-DO-NOT-USE-IN-PROD';

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || JWT_DEV_FALLBACK;
}
