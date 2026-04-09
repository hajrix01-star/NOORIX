/** ثوابت مشتركة لشاشة الإعدادات */

export const labelStyle = { display: 'block', marginBottom: 4, fontSize: 14 };

export const DELETE_CODE_KEY     = 'noorix-delete-code';
export const DEFAULT_DELETE_CODE = '123';

export function getDeleteCode() {
  try   { return localStorage.getItem(DELETE_CODE_KEY) || DEFAULT_DELETE_CODE; }
  catch { return DEFAULT_DELETE_CODE; }
}
export function setDeleteCode(value) {
  try { localStorage.setItem(DELETE_CODE_KEY, value || DEFAULT_DELETE_CODE); }
  catch (_) {}
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
