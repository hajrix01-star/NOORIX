import { uploadDocumentFile } from '../../../../../services/api';

export async function renderPdfFileFromElement(element: HTMLElement, fileBaseName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  });
  const imageData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  let imgWidth = maxWidth;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;
  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = (canvas.width * imgHeight) / canvas.height;
  }
  const x = (pageWidth - imgWidth) / 2;
  const y = (pageHeight - imgHeight) / 2;
  pdf.addImage(imageData, 'PNG', x, y, imgWidth, imgHeight);
  const blob = pdf.output('blob');
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
  temp.style.position = 'fixed';
  temp.style.left = '-100000px';
  temp.style.top = '0';
  temp.style.width = '960px';
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
