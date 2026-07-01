/**
 * printUtils — نافذة الطباعة المركزية لـ Noorix
 *
 * openPrintWindow(opts) — يبني HTML احترافياً ويفتح نافذة الطباعة
 *
 * الاستخدام البسيط (جداول):
 *   openPrintWindow({ companyName, subtitle, title, body: tableHtml });
 *
 * الاستخدام المتقدم (وثائق ذات تخطيط خاص):
 *   openPrintWindow({ title, body: fullDocHtml, extraCss: docSpecificCss });
 */

const NOORIX_BLUE = '#185FA5';

function formatPrintFooterDate(lang: string) {
  try {
    return new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * CSS الأساسي المشترك — @page، خط Cairo، جدول، ترويسة، تذييل
 * @param {boolean} landscape
 * @param {{ showPageCounter?: boolean; marginMm?: number }} [opts]
 */
type PrintPageOpts = { showPageCounter?: boolean; marginMm?: number };

function buildBaseCss(landscape: boolean, opts: PrintPageOpts = {}) {
  const showPageCounter = opts.showPageCounter !== false;
  const marginMm = Number.isFinite(opts.marginMm) ? (opts.marginMm as number) : landscape ? 10 : 12;
  const bottomMarginMm = showPageCounter ? Math.max(marginMm + 6, 18) : marginMm;
  const pageCounterBlock = showPageCounter
    ? `
  @bottom-center {
    content: "صفحة " counter(page) " من " counter(pages);
    font-family: 'Cairo', Arial, sans-serif;
    font-size: 10px;
    color: #555;
  }`
    : '';
  return `
@page {
  size: ${landscape ? 'A4 landscape' : 'A4'};
  margin: ${marginMm}mm ${marginMm}mm ${bottomMarginMm}mm;
${pageCounterBlock}
}
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: 'Cairo', Arial, sans-serif;
  margin: 0;
  padding: ${landscape ? '16px' : '24px'};
  color: #1a1a1a;
  font-size: 13px;
  line-height: 1.6;
}
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: right; }
th { background: ${NOORIX_BLUE}; color: #fff; font-weight: 700; }
tr:nth-child(even) td { background: #f8fafc; }
tfoot tr td { font-weight: 700; background: #f1f5f9; }
.print-header {
  text-align: center;
  border-bottom: 2px solid ${NOORIX_BLUE};
  padding-bottom: 14px;
  margin-bottom: 20px;
}
.print-header img {
  max-height: 48px;
  margin-bottom: 6px;
  display: block;
  margin-inline: auto;
}
.print-header h1 { margin: 0 0 4px; font-size: 20px; font-weight: 800; color: #0f172a; }
.print-header .sub { font-size: 12px; color: #555; margin: 2px 0; }
.print-footer {
  margin-top: 24px;
  padding-top: 8px;
  border-top: 1px solid #ddd;
  text-align: center;
  font-size: 11px;
  color: #777;
}
.print-toolbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 0 14px;
  margin-bottom: 14px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}
.print-toolbar__button {
  border: 0;
  border-radius: 8px;
  background: ${NOORIX_BLUE};
  color: #fff;
  padding: 9px 18px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}
.print-toolbar__button:hover { background: #0f4e8d; }
@media print {
  body { padding: 0; }
  .print-toolbar { display: none !important; }
}
`.trim();
}

function escHtml(v: any) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * يفتح نافذة طباعة احترافية بـ Cairo + @page + ترقيم صفحات + تذييل تلقائي
 *
 * @param {object}  opts
 * @param {string}  opts.title        - عنوان تبويب المتصفح
 * @param {string}  opts.body         - محتوى <body>: الجدول أو الوثيقة الكاملة
 * @param {string}  [opts.companyName] - اسم الشركة — يُظهر banner ترويسة قياسية عند توفّره
 * @param {string}  [opts.subtitle]   - السطر الثاني في الترويسة (الفترة، القسم...)
 * @param {string}  [opts.logoUrl]    - رابط شعار الشركة (اختياري)
 * @param {boolean} [opts.landscape]  - طباعة أفقية (افتراضي: false)
 * @param {string}  [opts.extraCss]   - CSS إضافي للوثائق ذات التخطيط الخاص
 * @param {boolean} [opts.showPageCounter] - تذييل ترقيم الصفحات (افتراضي: true)
 * @param {string}  [opts.htmlDir]     - اتجاه المستند: rtl | ltr (افتراضي rtl)
 * @param {string}  [opts.htmlLang]    - لغة وسم html (افتراضي ar)
 */
type OpenPrintWindowOpts = {
  title?: string;
  body?: string;
  companyName?: string;
  subtitle?: string;
  logoUrl?: string;
  landscape?: boolean;
  extraCss?: string;
  showPageCounter?: boolean;
  pageMarginMm?: number;
  htmlDir?: 'rtl' | 'ltr';
  htmlLang?: string;
  autoPrint?: boolean;
};

export function openPrintWindow({
  title = '',
  body = '',
  companyName = '',
  subtitle = '',
  logoUrl = '',
  landscape = false,
  extraCss = '',
  showPageCounter = true,
  pageMarginMm,
  htmlDir = 'rtl',
  htmlLang = 'ar',
  autoPrint = true,
}: OpenPrintWindowOpts = {}) {
  const headerHtml = companyName
    ? `<div class="print-header">
        ${logoUrl ? `<img src="${escHtml(logoUrl)}" alt="" />` : ''}
        <h1>${escHtml(companyName)}</h1>
        ${subtitle ? `<div class="sub">${escHtml(subtitle)}</div>` : ''}
      </div>`
    : '';

  const footerText =
    htmlLang === 'en'
      ? `Printed on: ${formatPrintFooterDate('en')}`
      : `طُبع بتاريخ: ${formatPrintFooterDate('ar')}`;
  const toolbarHtml = autoPrint
    ? ''
    : `<div class="print-toolbar"><button class="print-toolbar__button" type="button" onclick="window.print()">${htmlLang === 'en' ? 'Print' : 'طباعة'}</button></div>`;

  const html = `<!DOCTYPE html>
<html dir="${escHtml(htmlDir)}" lang="${escHtml(htmlLang)}">
<head>
<meta charset="utf-8">
<title>${escHtml(title || companyName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
${buildBaseCss(landscape, { showPageCounter, marginMm: pageMarginMm })}
${extraCss ? `\n/* — CSS خاص بالوثيقة — */\n${extraCss}` : ''}
</style>
</head>
<body>
${toolbarHtml}
${headerHtml}
${body}
<div class="print-footer">${footerText}</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  if (autoPrint) {
    win.onafterprint = () => { try { win.close(); } catch (_: any) {} };
    win.onload = () => setTimeout(() => win.print(), 300);
  }
}
