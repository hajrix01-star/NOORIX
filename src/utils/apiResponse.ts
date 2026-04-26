/**
 * عقد استجابة الـ API الموحّد (Noorix backend).
 * معظم نقاط النهاية ترجع كائناً يحتوي `success: boolean`.
 * عند `success === false` يجب عدم اعتبار العملية ناجحة في React Query.
 */

/**
 * استخراج رسالة خطأ من نتيجة API.
 * @param {unknown} result
 * @param {string} [fallback]
 * @returns {string}
 */
export function getApiErrorMessage(result, fallback = 'Request failed') {
  if (!result || typeof result !== 'object') return fallback;
  const r = /** @type {{ error?: string, message?: string }} */ (result);
  return r.error || r.message || fallback;
}

/**
 * إن كانت النتيجة `{ success: false }` يرمى Error حتى تتعامل معه React Query كفشل.
 * لا يفعل شيئاً إذا لم يكن الحقل `success` موجوداً (مثلاً استجابة خام أو بيانات فقط).
 *
 * @param {unknown} result
 * @param {string} [fallbackMessage]
 * @throws {Error & { apiResult?: unknown }}
 */
export function rejectIfApiFailed(result, fallbackMessage = 'Request failed') {
  if (
    result
    && typeof result === 'object'
    && Object.prototype.hasOwnProperty.call(result, 'success')
    && /** @type {{ success: boolean }} */ (result).success === false
  ) {
    const msg = getApiErrorMessage(result, fallbackMessage);
    const err = new Error(msg) as Error & { apiResult?: unknown };
    err.apiResult = result;
    throw err;
  }
}

/**
 * يتحقق من `success !== false` ثم يعيد النتيجة؛ مفيد بعد `await` في نماذج واستيراد متوازي.
 *
 * @param {unknown} result
 * @param {string} [fallbackMessage]
 * @returns {unknown}
 * @throws {Error & { apiResult?: unknown }}
 */
export function assertApiOk(result, fallbackMessage = 'Request failed') {
  rejectIfApiFailed(result, fallbackMessage);
  return result;
}
