/** ثوابت مشتركة لشاشة الإعدادات */

export const labelStyle = { display: 'block', marginBottom: 4, fontSize: 14 };

export function fileToDataUrl(file: any) {
  return new Promise((resolve: any, reject: any) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
