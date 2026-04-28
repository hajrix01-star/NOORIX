/**
 * Theme Preview — وضع التطوير أو super_admin في الإنتاج فقط
 * (نفس قاعدة إظهار الرابط في السايدبار)
 */
export function canAccessThemePreview(userRole: string | undefined): boolean {
  if (import.meta.env.DEV) return true;
  return String(userRole || '').toLowerCase() === 'super_admin';
}
