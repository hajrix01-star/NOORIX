/**
 * ضغط صورة من File إلى JPEG (data URL) — استخدام موحّد لشاشات OCR/الكاشير.
 * @param {File} file
 * @param {{ maxDim?: number, quality?: number }} opts
 * @returns {Promise<string>} data: URL (image/jpeg)
 */
type CompressOpts = { maxDim?: number; quality?: number };

export function compressImageFileToJpegDataUrl(file: File, opts: CompressOpts = {}) {
  const { maxDim = 1600, quality = 0.82 } = opts;
  return new Promise((resolve: any, reject: any) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Expected an image file'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = (ev: any) => {
      const src = ev.target?.result;
      if (typeof src !== 'string') {
        reject(new Error('read failed'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('image load failed'));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
