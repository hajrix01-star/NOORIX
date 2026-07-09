import { uploadDocumentFile } from '../../../../../services/api';

const HR_DOCUMENT_UPLOAD_SAFE_BYTES = 9.5 * 1024 * 1024;
const HR_DOCUMENT_A4_WIDTH_PX = 794;
const HR_DOCUMENT_RENDER_SCALE = 2.5;

async function waitForRenderableImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  }));
}

export async function renderPdfFileFromElement(element: HTMLElement, fileBaseName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  await waitForRenderableImages(element);
  const canvas = await html2canvas(element, {
    scale: Math.max(HR_DOCUMENT_RENDER_SCALE, window.devicePixelRatio || 1),
    backgroundColor: '#ffffff',
    useCORS: true,
  });
  const buildPdfBlob = (imageData: string, imageType: 'PNG' | 'JPEG') => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const maxWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * maxWidth) / canvas.width;
    const pageBodyHeight = pageHeight - margin * 2;
    let remainingHeight = imageHeight;
    let y = margin;

    pdf.addImage(imageData, imageType, margin, y, maxWidth, imageHeight, 'employee-doc-render', 'SLOW');
    remainingHeight -= pageBodyHeight;

    while (remainingHeight > 0) {
      pdf.addPage();
      y = margin - (imageHeight - remainingHeight);
      pdf.addImage(imageData, imageType, margin, y, maxWidth, imageHeight, 'employee-doc-render', 'SLOW');
      remainingHeight -= pageBodyHeight;
    }

    return pdf.output('blob');
  };

  let blob = buildPdfBlob(canvas.toDataURL('image/png'), 'PNG');
  for (const quality of [0.94, 0.88, 0.78, 0.65]) {
    if (blob.size <= HR_DOCUMENT_UPLOAD_SAFE_BYTES) break;
    blob = buildPdfBlob(canvas.toDataURL('image/jpeg', quality), 'JPEG');
  }
  if (blob.size > HR_DOCUMENT_UPLOAD_SAFE_BYTES) {
    throw new Error('تعذر حفظ المستند لأن حجم PDF لا يزال كبيرًا. جرّب تقليل حجم شعار الشركة ثم أعد الحفظ.');
  }

  return new File([blob], `${fileBaseName}.pdf`, { type: 'application/pdf' });
}

export async function uploadRenderedDocument({
  companyId,
  employeeId,
  documentType,
  fileBaseName,
  html,
}: {
  companyId: string;
  employeeId: string;
  documentType: string;
  fileBaseName: string;
  html: string;
}) {
  const temp = document.createElement('div');
  temp.className = 'employee-doc-preview-drawer employee-doc-render-mode';
  temp.style.position = 'fixed';
  temp.style.left = '-100000px';
  temp.style.top = '0';
  temp.style.width = `${HR_DOCUMENT_A4_WIDTH_PX}px`;
  temp.style.background = '#fff';
  temp.innerHTML = html;
  document.body.appendChild(temp);
  let file: File;
  try {
    file = await renderPdfFileFromElement(temp, fileBaseName);
  } finally {
    document.body.removeChild(temp);
  }
  return uploadDocumentFile({
    companyId,
    employeeId,
    documentType,
    file,
  });
}
