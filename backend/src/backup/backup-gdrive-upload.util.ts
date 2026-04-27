import * as fs from 'fs/promises';

export const MAX_EXTERNAL_UPLOAD_BYTES = 18 * 1024 * 1024; // تجنّب تعطّل الذاكرة مع Apps Script الحالي

/**
 * رفع ملف نسخة إلى سكربت Google Apps (base64) عند تكوين الرابط/المجلد.
 */
export async function uploadToExternalIfConfigured(
  absPath: string,
  filename: string,
  meta: { company?: string; scope: string },
  preloaded?: { scriptUrl: string | null; folderId: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const envUrl = (process.env.BACKUP_GDRIVE_SCRIPT_URL || process.env.GDRIVE_SCRIPT_URL || '').trim();
  const dbUrl = (preloaded?.scriptUrl && preloaded.scriptUrl.length > 0 ? preloaded.scriptUrl : '').trim();
  const scriptUrl = dbUrl || envUrl;
  if (!scriptUrl) {
    return {
      ok: false,
      error:
        'لا يوجد رابط تخزين خارجي — أضف رابط Google Apps من إعدادات النسخ أو عيّن BACKUP_GDRIVE_SCRIPT_URL على الخادم',
    };
  }

  const st = await fs.stat(absPath);
  if (st.size > MAX_EXTERNAL_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `الملف أكبر من ${MAX_EXTERNAL_UPLOAD_BYTES >> 20} ميجابايت — ارفع يدوياً أو زد الحد لاحقاً`,
    };
  }

  const content_b64 = (await fs.readFile(absPath)).toString('base64');
  const folderId =
    preloaded?.folderId && String(preloaded.folderId).trim().length > 0
      ? String(preloaded.folderId).trim()
      : undefined;
  const payload = JSON.stringify({
    filename,
    content: content_b64,
    company: meta.company || 'noorix',
    scope: meta.scope,
    ...(folderId ? { folderId } : {}),
  });

  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(120_000),
    });
    const raw = await res.text();
    let json: { ok?: boolean; error?: string; saved?: string } = {};
    try {
      json = raw ? (JSON.parse(raw) as { ok?: boolean; error?: string; saved?: string }) : {};
    } catch {
      const snippet = raw.replace(/\s+/g, ' ').slice(0, 200);
      return {
        ok: false,
        error: res.ok
          ? `استجابة غير JSON من السكربت: ${snippet}`
          : `HTTP ${res.status}: ${snippet || res.statusText}`,
      };
    }
    if (json?.ok) return { ok: true };
    return {
      ok: false,
      error: json?.error || (res.ok ? 'السكربت لم يُرجع ok: true' : `HTTP ${res.status}: ${raw.slice(0, 120)}`),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
