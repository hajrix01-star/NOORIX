import { throwIfApiFailed } from '../services/core/apiHttp';

/**
 * استخراج رسالة خطأ من نتيجة API.
 * @param {unknown} result
 * @param {string} [fallback]
 * @returns {string}
 */
export function getApiErrorMessage(result: any, fallback: any = 'Request failed') {
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
export function rejectIfApiFailed(result: any, fallbackMessage: any = 'Request failed') {
  if (
    !result
    || typeof result !== 'object'
    || !Object.prototype.hasOwnProperty.call(result, 'success')
    || result.success !== false
  ) {
    return;
  }
  try {
    throwIfApiFailed(result, fallbackMessage);
  } catch (err) {
    if (err instanceof Error) {
      (err as Error & { apiResult?: unknown }).apiResult = result;
    }
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
export function assertApiOk(result: any, fallbackMessage: any = 'Request failed') {
  rejectIfApiFailed(result, fallbackMessage);
  return result;
}
