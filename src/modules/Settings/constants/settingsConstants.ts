import type { CSSProperties } from 'react';

export const labelStyle: CSSProperties = { display: 'block', marginBottom: 4, fontSize: 14 };

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
