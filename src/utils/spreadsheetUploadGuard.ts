/**
 * قيود أمان لرفع جداول (Excel/CSV) — تخفيف مخاطر xlsx وملفات ضخمة/غير متوقعة.
 * لا يستبدل مكتبة xlsx؛ يحدّ الحجم والامتداد/MIME قبل القراءة في الذاكرة.
 */

/** حد أقصى لحجم الملف قبل تمريره إلى xlsx (واجهة) */
export const MAX_SPREADSHEET_UPLOAD_BYTES = 15 * 1024 * 1024;

const ALLOWED_EXT = new Set(['xlsx', 'xls', 'csv']);

const MIME_ALLOW: Record<string, readonly string[]> = {
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
    '',
  ],
  xls: ['application/vnd.ms-excel', 'application/octet-stream', ''],
  csv: ['text/csv', 'application/csv', 'text/plain', 'application/octet-stream', ''],
};

function extOf(file: File): string {
  const n = (file.name || '').trim().toLowerCase();
  const i = n.lastIndexOf('.');
  return i >= 0 ? n.slice(i + 1) : '';
}

/**
 * يتحقق من امتداد الاسم والحجم وMIME (إن وُجد) قبل قراءة الملف.
 * يُستدعى في مسارات الاستيراد فقط؛ التصدير لا يمر عبر رفع مستخدم.
 */
export function assertSpreadsheetUploadFile(file: File): void {
  if (!(file instanceof File)) {
    throw new Error('ملف غير صالح');
  }
  const ext = extOf(file);
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error('يُسمح فقط بملفات .xlsx أو .xls أو .csv');
  }
  if (file.size <= 0) {
    throw new Error('ملف فارغ');
  }
  if (file.size > MAX_SPREADSHEET_UPLOAD_BYTES) {
    throw new Error(
      `حجم الملف يتجاوز الحد المسموح (${Math.round(MAX_SPREADSHEET_UPLOAD_BYTES / (1024 * 1024))} ميجابايت)`,
    );
  }
  const mime = (file.type || '').trim().toLowerCase();
  const allowedMime = MIME_ALLOW[ext];
  if (allowedMime && mime && !allowedMime.includes(mime)) {
    throw new Error('نوع الملف (MIME) لا يطابق الامتداد — جرّب حفظ الملف بصيغة مدعومة من Excel');
  }
}
