/**
 * EmployeeDocModal — وثائق الموظف الاحترافية (ثنائية اللغة)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { getText } from '../../../i18n/translations';
import { formatSaudiDate, getSaudiToday, toYmd } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import Decimal from 'decimal.js';
import { uploadDocumentFile } from '../../../services/api';
import { assertApiOk } from '../../../utils/apiResponse';
import { parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';
import {
  parseWorkHours,
  overtimePay,
  SAUDI_STANDARD_HOURS,
} from '../utils/employeeSalaryMath';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import { openPrintWindow } from '../../../utils/printUtils';
import { useToast } from '../../../context/ToastContext';

const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWANCE_NAME_EN_MAP: Record<string, string> = {
  'بدل سكن': 'Housing Allowance',
  'السكن': 'Housing Allowance',
  'بدل مواصلات': 'Transport Allowance',
  'المواصلات': 'Transport Allowance',
  'بدل نقل': 'Transport Allowance',
  'بدل اكل': 'Meal Allowance',
  'بدل أكل': 'Meal Allowance',
  'الاكل': 'Meal Allowance',
  'الأكل': 'Meal Allowance',
  'بدل طعام': 'Meal Allowance',
  'بدل اوفر تايم': 'Overtime Allowance',
  'بدل أوفر تايم': 'Overtime Allowance',
  'اوفر تايم': 'Overtime Allowance',
  'أوفر تايم': 'Overtime Allowance',
  'بدل إضافي': 'Additional Allowance',
  'بدل اضافي': 'Additional Allowance',
};

function translateAllowanceToEnglish(nameAr: any = '') {
  const normalized = String(nameAr || '').trim();
  if (!normalized) return 'Allowance';
  if (ALLOWANCE_NAME_EN_MAP[normalized]) return ALLOWANCE_NAME_EN_MAP[normalized];
  const compact = normalized.replace(/\s+/g, ' ');
  if (ALLOWANCE_NAME_EN_MAP[compact]) return ALLOWANCE_NAME_EN_MAP[compact];
  return 'Custom Allowance';
}

function isMostlyArabicScript(text: any) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/** عمود إنجليزي: إن كان المسمى عربياً فقط نعرض — حتى لا يتكرر العربي في العمود الإنجليزي */
function displayJobTitleEn(employee: any) {
  const jt = String(employee?.jobTitle || '').trim();
  if (!jt) return '—';
  return isMostlyArabicScript(jt) ? '—' : jt;
}

const DOC_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 1px minmax(0, 1fr)',
  columnGap: 10,
  direction: 'ltr',
  alignItems: 'stretch',
};

const DOC_SEP: CSSProperties = { background: '#cbd5e1', borderRadius: 999, width: 1, minWidth: 1, alignSelf: 'stretch' };

const DOC_TABLE_BASE: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 11,
  tableLayout: 'fixed',
};

const DOC_TH: CSSProperties = {
  background: '#f1f5f9',
  border: '1px solid #dbe1e8',
  padding: '5px 6px',
  fontWeight: 700,
  fontSize: 10,
  textAlign: 'center',
  color: '#334155',
};

const DOC_TD: CSSProperties = {
  border: '1px solid #e2e8f0',
  padding: '5px 7px',
  fontSize: 11,
  verticalAlign: 'top',
  wordBreak: 'break-word',
};

const DOC_BOX: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--noorix-border)',
  borderRadius: 8,
  background: '#fff',
};

const DOC_H3: CSSProperties = {
  margin: '0 0 6px',
  fontSize: 12,
  fontWeight: 800,
  textAlign: 'center',
  color: '#0f172a',
};

const SETTLE_SECTION: CSSProperties = { padding: '10px 14px', borderBottom: '1px solid var(--noorix-border)' };

function calculateServiceDays(joinDate: any, endDate: any) {
  const start = new Date(joinDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function getEligibilityFactor(reason: any, serviceYears: any) {
  if (reason === 'article80') return new Decimal(0);
  if (reason === 'employer' || reason === 'article81') return new Decimal(1);
  if (serviceYears < 2) return new Decimal(0);
  if (serviceYears < 5) return new Decimal(1).div(3);
  if (serviceYears < 10) return new Decimal(2).div(3);
  return new Decimal(1);
}

function mapReasonByMeta(reasonText: any = '', clause: any = '') {
  const reason = String(reasonText || '').toLowerCase();
  const legalClause = String(clause || '').toLowerCase();
  if (legalClause.includes('80') || reason.includes('80')) return 'article80';
  if (legalClause.includes('81') || reason.includes('81')) return 'article81';
  if (reason.includes('استقال') || reason.includes('resign')) return 'resignation';
  return 'employer';
}

function buildSalaryRows(employee: any, customAllowances: any = []) {
  const rows = [];
  const basic = new Decimal(employee?.basicSalary ?? 0);
  const housing = new Decimal(employee?.housingAllowance ?? 0);
  const transport = new Decimal(employee?.transportAllowance ?? 0);
  const other = new Decimal(employee?.otherAllowance ?? 0);
  if (basic.gt(0)) rows.push({ ar: 'الراتب الأساسي', en: 'Basic Salary', amount: basic.toNumber() });
  if (housing.gt(0)) rows.push({ ar: 'بدل السكن', en: 'Housing Allowance', amount: housing.toNumber() });
  if (transport.gt(0)) rows.push({ ar: 'بدل المواصلات', en: 'Transport Allowance', amount: transport.toNumber() });
  if (other.gt(0)) rows.push({ ar: 'بدل آخر', en: 'Other Allowance', amount: other.toNumber() });
  for (const row of customAllowances) {
    const amount = Number(row.amount ?? 0);
    if (amount > 0) {
      rows.push({
        ar: row.nameAr || row.nameEn || 'بدل',
        en: row.nameEn || translateAllowanceToEnglish(row.nameAr),
        amount,
      });
    }
  }
  const customTotal = customAllowances.reduce((s: any, row: any) => s + (Number(row.amount) || 0), 0);
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(employee?.workHours) - SAUDI_STANDARD_HOURS);
  if (overtimeHoursPerDay > 0) {
    const overtimeAmount = overtimePay(employee, customTotal);
    rows.push({ ar: `مقابل الأوفر تايم (${hrFmt(overtimeHoursPerDay)} ساعة/يوم)`, en: `Overtime Pay (${hrFmt(overtimeHoursPerDay)} hr/day)`, amount: overtimeAmount });
  }
  const total = rows.reduce((sum: any, row: any) => sum + row.amount, 0);
  return { rows, total };
}

const EMPLOYEE_DOC_EXTRA_CSS = `
  body{font-size:11px;line-height:1.45}
  .doc{border:1px solid #d6dbe3;border-radius:10px;overflow:hidden}
  .header{padding:12px 14px;border-bottom:2px solid #0f172a;background:#f8fafc}
  .title{font-size:18px;font-weight:800;text-align:center;margin:0}
  .subtitle{font-size:11px;text-align:center;color:#475569;margin-top:4px}
  .section{padding:10px 14px;border-bottom:1px solid #e5e7eb}
  .section:last-child{border-bottom:none}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .bilingual{display:grid;grid-template-columns:minmax(0,1fr) 1px minmax(0,1fr);column-gap:10px;direction:ltr;align-items:stretch}
  .hr-bilingual-sep{background:#cbd5e1;border-radius:999px;width:1px;min-width:1px}
  .box{padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
  .box h3{margin:0 0 6px;font-size:12px;text-align:center;font-weight:800}
  .box p,.box li{margin:0 0 6px;line-height:1.5;font-size:10.5px}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px}
  th,td{padding:4px 6px;border:1px solid #dbe1e8}
  th{background:#f1f5f9;font-weight:700;text-align:center;color:#334155}
  .num{font-family:'Cairo',Arial,sans-serif}
  .footer{padding:10px 14px}
  .signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px}
  .sig{padding-top:24px;border-top:1px solid #cbd5e1;font-size:10px}
  @media print{.doc{border:none;border-radius:0}}
`;

async function renderPdfFileFromElement(element: any, fileBaseName: any) {
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

/** كائن يشبه نافذة الطباعة — الحقول قابلة للتعيين بعد `openPrintWindow` الداخلي */
type PrintWindowStub = {
  onload: (() => void) | null;
  onafterprint: (() => void) | null;
  print: () => void;
  close: () => void;
};

function buildPrintWindow(title: any, html: any): PrintWindowStub {
  openPrintWindow({ title, body: html, extraCss: EMPLOYEE_DOC_EXTRA_CSS });
  return {
    onload: null,
    onafterprint: null,
    print: () => {},
    close: () => {},
  };
}

function ModalShell({ title, children, onClose, onPrint, onSave, saving, t }: any) {
  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={title}
      size="lg"
      side="start"
      className="employee-doc-preview-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('close')}</Button>
          <Button onClick={onPrint}>{t('print') || 'طباعة'}</Button>
          <Button variant="primary" disabled={saving} onClick={onSave}>
            {saving ? t('saving') : (t('saveToDocuments') || 'حفظ في المستندات')}
          </Button>
        </>
      }
    >
      {children}
    </AdaptiveSheet>
  );
}

function DocumentFrame({ companyName, companyLogo, arabicTitle, englishTitle, children, compact = false }: any) {
  const pad = compact ? '10px 14px' : '18px 22px';
  const logoH = compact ? 40 : 56;
  const nameFs = compact ? 15 : 20;
  const titleFs = compact ? 14 : 20;
  const subFs = compact ? 11 : 12;
  return (
    <div className="doc" style={{ border: '1px solid var(--noorix-border)', borderRadius: compact ? 10 : 14, overflow: 'hidden', background: '#fff', maxWidth: compact ? '190mm' : undefined, margin: compact ? '0 auto' : undefined }}>
      <div style={{ padding: pad, borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
        {companyLogo ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: compact ? 4 : 8 }}>
            <img src={companyLogo} alt="company-logo" style={{ maxHeight: logoH, objectFit: 'contain' }} />
          </div>
        ) : null}
        <div style={{ textAlign: 'center', fontSize: nameFs, fontWeight: 800 }}>{companyName || 'الشركة'}</div>
        <div style={{ textAlign: 'center', marginTop: compact ? 2 : 6, color: '#475569', fontSize: compact ? 11 : undefined }}>{companyName || 'Company'}</div>
        <div style={{ textAlign: 'center', marginTop: compact ? 8 : 14, fontWeight: 800, fontSize: titleFs }}>{arabicTitle}</div>
        <div style={{ textAlign: 'center', color: '#475569', marginTop: 2, fontSize: subFs }}>{englishTitle}</div>
        <div style={{ textAlign: 'center', marginTop: 2, color: '#64748b', fontSize: compact ? 10 : 12 }}>
          التاريخ / Date: {formatSaudiDate(new Date())}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmployeeInfoTable({ employee, workHoursValue = '', contractEnd = '' }: any) {
  const wh = workHoursValue || employee?.workHours || '8';
  const baseRows = [
    {
      arLabel: 'اسم الموظف',
      enLabel: 'Employee Name',
      arVal: employee?.name || employee?.nameAr || '—',
      enVal: employee?.nameEn || '—',
    },
    {
      arLabel: 'المسمى الوظيفي',
      enLabel: 'Job Title',
      arVal: employee?.jobTitle || '—',
      enVal: displayJobTitleEn(employee),
    },
    {
      arLabel: 'رقم الإقامة',
      enLabel: 'Iqama Number',
      arVal: employee?.iqamaNumber || '—',
      enVal: employee?.iqamaNumber || '—',
    },
    {
      arLabel: 'تاريخ التعيين',
      enLabel: 'Join Date',
      arVal: formatSaudiDate(employee?.joinDate) || '—',
      enVal: formatSaudiDate(employee?.joinDate) || '—',
    },
    {
      arLabel: 'ساعات العمل',
      enLabel: 'Working Hours',
      arVal: wh,
      enVal: wh,
    },
  ];
  const infoRows = contractEnd
    ? [
        ...baseRows,
        {
          arLabel: 'تاريخ انتهاء العقد',
          enLabel: 'Contract End Date',
          arVal: formatSaudiDate(contractEnd) || contractEnd,
          enVal: formatSaudiDate(contractEnd) || contractEnd,
        },
      ]
    : baseRows;
  return (
    <div className="bilingual" style={DOC_GRID}>
      <table style={{ ...DOC_TABLE_BASE, direction: 'ltr' }}>
        <thead>
          <tr>
            <th style={{ ...DOC_TH, width: '38%' }}>Item</th>
            <th style={{ ...DOC_TH, width: '62%' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {infoRows.map((row: any) => (
            <tr key={row.enLabel}>
              <td style={{ ...DOC_TD, textAlign: 'left', direction: 'ltr' }}>{row.enLabel}</td>
              <td style={{ ...DOC_TD, textAlign: 'left', direction: 'ltr' }}>{row.enVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
      <table style={{ ...DOC_TABLE_BASE, direction: 'rtl' }}>
        <thead>
          <tr>
            <th style={{ ...DOC_TH, width: '38%' }}>العنصر</th>
            <th style={{ ...DOC_TH, width: '62%' }}>البيان</th>
          </tr>
        </thead>
        <tbody>
          {infoRows.map((row: any) => (
            <tr key={row.arLabel}>
              <td style={{ ...DOC_TD, textAlign: 'right' }}>{row.arLabel}</td>
              <td style={{ ...DOC_TD, textAlign: 'right' }}>{row.arVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalaryBreakdownTable({ rows, total }: any) {
  return (
    <div className="bilingual" style={DOC_GRID}>
      <table style={{ ...DOC_TABLE_BASE, direction: 'ltr' }}>
        <thead>
          <tr>
            <th style={{ ...DOC_TH, width: '58%' }}>Component</th>
            <th style={{ ...DOC_TH, width: '42%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, idx: any) => (
            <tr key={`en-${row.en}-${idx}`}>
              <td style={{ ...DOC_TD, textAlign: 'left' }}>{row.en}</td>
              <td style={{ ...DOC_TD, textAlign: 'right', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{hrFmt(row.amount)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...DOC_TD, textAlign: 'left', fontWeight: 800 }}>Total Compensation</td>
            <td style={{ ...DOC_TD, textAlign: 'right', direction: 'ltr', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{hrFmt(total)}</td>
          </tr>
        </tbody>
      </table>
      <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
      <table style={{ ...DOC_TABLE_BASE, direction: 'rtl' }}>
        <thead>
          <tr>
            <th style={{ ...DOC_TH, width: '58%' }}>المكون</th>
            <th style={{ ...DOC_TH, width: '42%' }}>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, idx: any) => (
            <tr key={`ar-${row.ar}-${idx}`}>
              <td style={{ ...DOC_TD, textAlign: 'right' }}>{row.ar}</td>
              <td style={{ ...DOC_TD, textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>{hrFmt(row.amount)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...DOC_TD, textAlign: 'right', fontWeight: 800 }}>إجمالي الراتب</td>
            <td style={{ ...DOC_TD, textAlign: 'center', direction: 'ltr', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{hrFmt(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

async function uploadRenderedDocument({ companyId, employeeId, documentType, fileBaseName, html }: any) {
  const temp = document.createElement('div');
  temp.style.position = 'fixed';
  temp.style.left = '-100000px';
  temp.style.top = '0';
  temp.style.width = '960px';
  temp.style.background = '#fff';
  temp.innerHTML = html;
  document.body.appendChild(temp);
  let file;
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

function buildDocFileBaseName(prefix: any, employee: any) {
  const employeeName = employee?.name || employee?.nameAr || 'employee';
  const datePart = formatSaudiDate(new Date()).replace(/\//g, '-');
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${prefix}-${employeeName}-${datePart}-${hh}-${mm}-${ss}`;
}

function getTerminationSummary(employee: any) {
  const status = String(employee?.status || '').toLowerCase();
  const parsed = parseEmployeeNotesMeta(employee?.notes);
  const meta = parsed.meta || {};
  const reasonAr = meta.terminationReason || employee?.terminationReasonAr || employee?.terminationReason || employee?.statusReason || '';
  const reasonEn = employee?.terminationReasonEn || '';
  const clause = meta.terminationClause || employee?.terminationClause || employee?.laborArticle || '';
  const terminationDate = meta.terminationDate || '';
  if (status !== 'terminated') {
    return {
      ar: 'الموظف على رأس العمل (لا يوجد إنهاء خدمة مسجل).',
      en: 'Employee is active (no termination record).',
      clauseAr: 'غير منطبق',
      clauseEn: 'Not applicable',
      terminationDate,
      reasonCode: 'employer',
    };
  }
  return {
    ar: `إنهاء خدمة الموظف${reasonAr ? ` - السبب: ${reasonAr}` : ''}.`,
    en: `Employment terminated${reasonEn ? ` - reason: ${reasonEn}` : ''}.`,
    clauseAr: clause ? `البند النظامي: ${clause}` : 'البند النظامي: غير محدد',
    clauseEn: clause ? `Legal clause: ${clause}` : 'Legal clause: Not specified',
    terminationDate,
    reasonCode: mapReasonByMeta(reasonAr, clause),
  };
}

/** إزالة صياغة التعويض / م77 من نصوص الإقرار عند المخالصة بدون نهاية خدمة */
function stripArt77CompensationPhrases(text: any) {
  if (text == null || typeof text !== 'string') return text;
  let s = text;
  s = s.replace(/\s*مع\s+تعويض\s*\(\s*مادة\s*77\s*\)/gi, '');
  s = s.replace(/\s*مع\s+تعويض\s*\(\s*ماده\s*77\s*\)/gi, '');
  s = s.replace(/\s*with\s+compensation\s*\(\s*Art\.?\s*77\s*\)/gi, '');
  s = s.replace(/\s*with\s+compensation\s*\(\s*Article\s*77\s*\)/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

export function SalaryCertificateModal({ employee, customAllowances = [], companyId, companyName, companyLogo, onClose, onSaved }: any) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const printRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const { rows, total } = useMemo(() => buildSalaryRows(employee, customAllowances), [employee, customAllowances]);

  const handlePrint = () => {
    const win = buildPrintWindow(t('salaryCertificate') || 'Salary Certificate', printRef.current?.innerHTML || '');
    if (!win) {
      showToast(t('allowPopupsForPrint') || 'يرجى السماح بالنوافذ المنبثقة للموقع ثم المحاولة مرة أخرى', 'error');
      return;
    }
    win.onload = () => {
      win.onafterprint = () => win.close();
      win.print();
    };
  };

  const handleSaveToDocuments = async () => {
    if (!employee?.id || !companyId) return;
    setSaving(true);
    try {
      const fileBaseName = buildDocFileBaseName('salary-certificate', employee);
      const res = await uploadRenderedDocument({
        companyId,
        employeeId: employee.id,
        documentType: 'certificate',
        fileBaseName,
        html: printRef.current?.innerHTML || '',
      });
      assertApiOk(res, t('saveFailed'));
      onSaved?.();
      onClose?.();
    } catch (err: any) {
      showToast(err?.message || 'فشل حفظ المستند', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={t('salaryCertificate') || 'شهادة تعريف راتب'} onClose={onClose} onPrint={handlePrint} onSave={handleSaveToDocuments} saving={saving} t={t}>
      <div ref={printRef}>
        <DocumentFrame companyName={companyName} companyLogo={companyLogo} arabicTitle="شهادة تعريف راتب" englishTitle="Employment & Salary Certificate">
          <div className="section" style={{ padding: '10px 14px', borderBottom: '1px solid var(--noorix-border)' }}>
            <div className="bilingual" style={DOC_GRID}>
              <div style={{ ...DOC_BOX, direction: 'ltr', textAlign: 'left' }}>
                <h3 style={DOC_H3}>Certification</h3>
                <p style={{ lineHeight: 1.5, margin: 0, fontSize: 11 }}>
                  This is to certify that <strong>{employee?.nameEn || employee?.name || employee?.nameAr || '—'}</strong> is employed by the company as
                  <strong> {displayJobTitleEn(employee)}</strong> since <strong>{formatSaudiDate(employee?.joinDate)}</strong> and remains employed as of the issue date of this certificate.
                </p>
              </div>
              <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
              <div style={{ ...DOC_BOX, direction: 'rtl', textAlign: 'right' }}>
                <h3 style={DOC_H3}>إفادة</h3>
                <p style={{ lineHeight: 1.5, margin: 0, fontSize: 11 }}>
                  تشهد الشركة بأن الموظف/ة <strong>{employee?.name || employee?.nameAr || '—'}</strong> يعمل/تعمل لدينا بوظيفة
                  <strong> {employee?.jobTitle || '—'}</strong> منذ تاريخ <strong>{formatSaudiDate(employee?.joinDate)}</strong>
                  ، وما زال/تزال على رأس العمل حتى تاريخ إصدار هذه الشهادة.
                </p>
              </div>
            </div>
          </div>
          <div className="section" style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <EmployeeInfoTable employee={employee} />
          </div>
          <div className="section" style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <SalaryBreakdownTable rows={rows} total={total} />
          </div>
          <div className="footer" style={{ padding: '18px 22px' }}>
            <div style={{ color: '#64748b', fontSize: 12 }}>تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginTop: 22 }}>
              <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>اعتماد الشركة / Company Authorization</div>
              <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>الختم / Stamp</div>

            </div>
          </div>
        </DocumentFrame>
      </div>
    </ModalShell>
  );
}

export function ContractModal({ employee, customAllowances = [], companyId, companyName, companyLogo, onClose, onSaved }: any) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const printRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [contractEnd, setContractEnd] = useState(toYmd(employee?.contractEndDate) || '');
  const { rows, total } = useMemo(() => buildSalaryRows(employee, customAllowances), [employee, customAllowances]);

  const handlePrint = () => {
    const win = buildPrintWindow(t('documentContract') || 'Employment Contract', printRef.current?.innerHTML || '');
    if (!win) {
      showToast(t('allowPopupsForPrint') || 'يرجى السماح بالنوافذ المنبثقة للموقع ثم المحاولة مرة أخرى', 'error');
      return;
    }
    win.onload = () => {
      win.onafterprint = () => win.close();
      win.print();
    };
  };

  const handleSaveToDocuments = async () => {
    if (!employee?.id || !companyId) return;
    setSaving(true);
    try {
      const fileBaseName = buildDocFileBaseName('employment-contract', employee);
      const res = await uploadRenderedDocument({
        companyId,
        employeeId: employee.id,
        documentType: 'contract',
        fileBaseName,
        html: printRef.current?.innerHTML || '',
      });
      assertApiOk(res, t('saveFailed'));
      onSaved?.();
      onClose?.();
    } catch (err: any) {
      showToast(err?.message || 'فشل حفظ المستند', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={t('documentContract') || 'عقد عمل'} onClose={onClose} onPrint={handlePrint} onSave={handleSaveToDocuments} saving={saving} t={t}>
      <div className="flex items-center gap-12" style={{ padding: '8px 4px 12px', flexWrap: 'wrap' }}>
        <Input
          type="date"
          label="تاريخ انتهاء العقد (اختياري)"
          value={contractEnd}
          onChange={(e: any) => setContractEnd(e.target.value)}
        />
        {contractEnd && (
          <Button type="button" variant="ghost" onClick={() => setContractEnd('')} style={{ fontSize: 11, color: 'var(--noorix-accent-red)' }}>✕ إزالة</Button>
        )}
      </div>
      <div ref={printRef}>
        <DocumentFrame companyName={companyName} companyLogo={companyLogo} arabicTitle="عقد عمل" englishTitle="Employment Contract">
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <EmployeeInfoTable employee={employee} workHoursValue={employee?.workHours ? `${employee.workHours} ساعة / ${employee.workHours} hr` : '8 ساعات / 8 hr'} contractEnd={contractEnd} />
          </div>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <SalaryBreakdownTable rows={rows} total={total} />
          </div>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--noorix-border)' }}>
            <div className="bilingual" style={DOC_GRID}>
              <div style={{ ...DOC_BOX, direction: 'ltr', textAlign: 'left' }}>
                <h3 style={DOC_H3}>Key Terms</h3>
                <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.45, fontSize: 10.5 }}>
                  <li>The employee is appointed as {displayJobTitleEn(employee)}.</li>
                  <li>The work location shall be as assigned by the company according to operational needs.</li>
                  <li>Regular working hours are 8 hours per day. Any hours above that are treated as overtime, subject to employee approval and Saudi Labor Law.</li>
                  <li>The employee shall receive the fixed compensation listed in the salary breakdown attached to this contract.</li>
                  <li>This contract is governed by the applicable labor laws of the Kingdom of Saudi Arabia.</li>
                </ol>
              </div>
              <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
              <div style={{ ...DOC_BOX, direction: 'rtl', textAlign: 'right' }}>
                <h3 style={DOC_H3}>بنود أساسية</h3>
                <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.45, fontSize: 10.5 }}>
                  <li>تم تعيين الموظف في وظيفة {employee?.jobTitle || '—'}.</li>
                  <li>يكون مكان العمل حسب متطلبات الشركة وتعليماتها التنظيمية.</li>
                  <li>ساعات العمل الأساسية 8 ساعات يومياً، وأي ساعات إضافية فوق ذلك تعد أوفر تايم وتحسب وفق نظام العمل السعودي وبعد موافقة الموظف.</li>
                  <li>يتقاضى الموظف التعويضات الثابتة الموضحة في كشف الراتب الملحق بهذا العقد.</li>
                  <li>تطبق على هذا العقد أنظمة العمل المعمول بها في المملكة العربية السعودية.</li>
                </ol>
              </div>
            </div>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <div style={{ color: '#64748b', fontSize: 12 }}>تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 22 }}>
              <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>صاحب العمل / Employer</div>
              <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>الموظف / Employee</div>
              <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>الختم / Company Stamp</div>
            </div>
          </div>
        </DocumentFrame>
      </div>
    </ModalShell>
  );
}

export function FinalSettlementModal({ employee, customAllowances = [], companyId, companyName, companyLogo, onClose, onSaved }: any) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const printRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [includeEos, setIncludeEos] = useState(true);
  const { rows, total } = useMemo(() => buildSalaryRows(employee, customAllowances), [employee, customAllowances]);
  const lastMonthlyComp = total;
  const termination = useMemo(() => getTerminationSummary(employee), [employee]);
  const [eosEndDate, setEosEndDate] = useState(termination.terminationDate || getSaudiToday());
  const [eosReason, setEosReason] = useState(termination.reasonCode || 'employer');
  const [eosSalary, setEosSalary] = useState(String(lastMonthlyComp || 0));
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(employee?.workHours) - SAUDI_STANDARD_HOURS);

  useEffect(() => {
    setEosEndDate(termination.terminationDate || getSaudiToday());
    setEosReason(termination.reasonCode || 'employer');
    setEosSalary(new Decimal(lastMonthlyComp || 0).toDecimalPlaces(2).toString());
  }, [termination.terminationDate, termination.reasonCode, lastMonthlyComp]);
  const eos = useMemo(() => {
    const endDate = eosEndDate || termination.terminationDate || getSaudiToday();
    const serviceDays = calculateServiceDays(employee?.joinDate, endDate);
    const serviceYears = new Decimal(serviceDays).div(360);
    const firstFiveYears = Decimal.min(serviceYears, 5);
    const remainingYears = Decimal.max(serviceYears.minus(5), 0);
    const wageForEos = new Decimal(eosSalary || lastMonthlyComp || 0);
    const fullAward = wageForEos.times(firstFiveYears).times(0.5).plus(wageForEos.times(remainingYears));
    const eligibilityFactor = getEligibilityFactor(eosReason, serviceYears.toNumber());
    const eosAmount = fullAward.times(eligibilityFactor);
    const appliedEosAmount = includeEos ? eosAmount : new Decimal(0);
    return {
      serviceDays,
      serviceYears: serviceYears.toDecimalPlaces(2).toNumber(),
      wageForEos: wageForEos.toNumber(),
      fullAward: fullAward.toNumber(),
      factorPct: eligibilityFactor.times(100).toDecimalPlaces(2).toNumber(),
      eosAmount: eosAmount.toNumber(),
      appliedEosAmount: appliedEosAmount.toNumber(),
      finalTotal: appliedEosAmount.plus(lastMonthlyComp).toNumber(),
    };
  }, [employee?.joinDate, eosEndDate, eosReason, eosSalary, includeEos, lastMonthlyComp, termination.terminationDate]);

  const settlementDeclaration = useMemo(() => {
    if (includeEos) {
      return {
        ar: termination.ar,
        en: termination.en,
        clauseAr: termination.clauseAr,
        clauseEn: termination.clauseEn,
      };
    }
    const ar = stripArt77CompensationPhrases(termination.ar);
    const en = stripArt77CompensationPhrases(termination.en);
    const clauseArRaw = String(termination.clauseAr || '').trim();
    const clauseEnRaw = String(termination.clauseEn || '').trim();
    const clauseArOnly77 = /^البند\s*النظامي:\s*مادة\s*77\s*$/i.test(clauseArRaw) || /^البند\s*النظامي:\s*ماده\s*77\s*$/i.test(clauseArRaw);
    const clauseEnOnly77 =
      /^Legal\s+clause:\s*Article\s*77\s*$/i.test(clauseEnRaw) ||
      /^Legal\s+clause:\s*Art\.\s*77\s*$/i.test(clauseEnRaw) ||
      /^Legal\s+clause:\s*mادة\s*77\s*$/i.test(clauseEnRaw);
    return {
      ar,
      en,
      clauseAr: clauseArOnly77
        ? getText('finalSettlementClauseNeutralNoEos', 'ar')
        : stripArt77CompensationPhrases(termination.clauseAr),
      clauseEn: clauseEnOnly77
        ? getText('finalSettlementClauseNeutralNoEos', 'en')
        : stripArt77CompensationPhrases(termination.clauseEn),
    };
  }, [includeEos, termination.ar, termination.en, termination.clauseAr, termination.clauseEn]);

  const handlePrint = () => {
    const win = buildPrintWindow(t('finalSettlement') || 'Final Settlement', printRef.current?.innerHTML || '');
    if (!win) {
      showToast(t('allowPopupsForPrint') || 'يرجى السماح بالنوافذ المنبثقة للموقع ثم المحاولة مرة أخرى', 'error');
      return;
    }
    win.onload = () => {
      win.onafterprint = () => win.close();
      win.print();
    };
  };

  const handleSaveToDocuments = async () => {
    if (!employee?.id || !companyId) return;
    setSaving(true);
    try {
      const fileBaseName = buildDocFileBaseName('final-settlement', employee);
      const res = await uploadRenderedDocument({
        companyId,
        employeeId: employee.id,
        documentType: 'other',
        fileBaseName,
        html: printRef.current?.innerHTML || '',
      });
      assertApiOk(res, t('saveFailed'));
      onSaved?.();
      onClose?.();
    } catch (err: any) {
      showToast(err?.message || 'فشل حفظ المستند', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={t('finalSettlement') || 'مخالصة نهائية'} onClose={onClose} onPrint={handlePrint} onSave={handleSaveToDocuments} saving={saving} t={t}>
      <div ref={printRef}>
        <DocumentFrame compact companyName={companyName} companyLogo={companyLogo} arabicTitle="مخالصة وتسوية نهائية" englishTitle="Final Settlement & Clearance">
          <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--noorix-border)', background: '#f8fafc' }}>
            <label className="nx-checkbox">
              <input type="checkbox" checked={includeEos} onChange={(e: any) => setIncludeEos(e.target.checked)} />
              {includeEos ? t('includeEosInSettlement') : t('excludeEosInSettlement')}
            </label>
          </div>
          <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--noorix-border)', background: '#f8fafc' }}>
            <div className="font-bold mb-2">حاسبة نهاية الخدمة (تفصيل قبل الطباعة) / EOS Calculator (before print)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div>
                <Input type="date" label="تاريخ نهاية الخدمة" value={eosEndDate} onChange={(e: any) => setEosEndDate(e.target.value)} />
              </div>
              <div>
                <Input type="select" label="سبب الانتهاء" value={eosReason} onChange={(e: any) => setEosReason(e.target.value)}>
                  <option value="employer">{t('eosCalcReasonEmployer')}</option>
                  <option value="resignation">{t('eosCalcReasonResignation')}</option>
                  <option value="article81">{t('eosCalcReasonArticle81')}</option>
                  <option value="article80">{t('eosCalcReasonArticle80')}</option>
                </Input>
              </div>
              <div>
                <Input
                  type="number"
                  label="الأجر المعتمد لنهاية الخدمة"
                  min="0"
                  step="0.01"
                  value={eosSalary}
                  onChange={(e: any) => setEosSalary(e.target.value)}
                  onBlur={() => setEosSalary(new Decimal(eosSalary || 0).toDecimalPlaces(2).toString())}
                />
              </div>
            </div>
          </div>
          <div style={SETTLE_SECTION}>
            <EmployeeInfoTable employee={employee} />
          </div>
          <div style={SETTLE_SECTION}>
            <SalaryBreakdownTable rows={rows} total={lastMonthlyComp} />
          </div>
          <div style={SETTLE_SECTION}>
            <div className="bilingual" style={DOC_GRID}>
              <div style={{ ...DOC_BOX, direction: 'ltr', textAlign: 'left' }}>
                <h3 style={DOC_H3}>Final Entitlements Calculation</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '2px 10px', fontSize: 10.5, lineHeight: 1.3 }}>
                  {includeEos ? (
                    <>
                      <span>Service period (days)</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{eos.serviceDays}</span>
                      <span>Service period (years)</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.serviceYears)}</span>
                      <span>Work hours/day</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(parseWorkHours(employee?.workHours))}</span>
                      <span>Overtime hours/day</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(overtimeHoursPerDay)}</span>
                      <span>Wage used for EOS</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.wageForEos)}</span>
                      <span>Full EOS award</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.fullAward)}</span>
                      <span>Eligibility factor</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.factorPct)}%</span>
                      <span>EOS amount by law</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.eosAmount)}</span>
                      <span>Amount in settlement</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.appliedEosAmount)}</span>
                    </>
                  ) : null}
                  <span style={{ fontWeight: 800 }}>{includeEos ? t('finalSettlementTotalWithEos') : t('finalSettlementTotalSalaryOnly')}</span>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.finalTotal)}</span>
                </div>
              </div>
              <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
              <div style={{ ...DOC_BOX, direction: 'rtl', textAlign: 'right' }}>
                <h3 style={DOC_H3}>حسبة المستحقات النهائية</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '2px 10px', fontSize: 10.5, lineHeight: 1.3 }}>
                  {includeEos ? (
                    <>
                      <span>مدة الخدمة (يوم)</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{eos.serviceDays}</span>
                      <span>مدة الخدمة (سنة)</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.serviceYears)}</span>
                      <span>ساعات العمل اليومية</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(parseWorkHours(employee?.workHours))}</span>
                      <span>ساعات الأوفرتايم اليومية</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(overtimeHoursPerDay)}</span>
                      <span>الأجر المعتمد للحسبة</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.wageForEos)}</span>
                      <span>مكافأة نهاية الخدمة الكاملة</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.fullAward)}</span>
                      <span>نسبة الاستحقاق</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.factorPct)}%</span>
                      <span>قيمة نهاية الخدمة حسب النظام</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.eosAmount)}</span>
                      <span>القيمة المضافة في المخالصة</span><span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.appliedEosAmount)}</span>
                    </>
                  ) : null}
                  <span style={{ fontWeight: 800 }}>{includeEos ? t('finalSettlementTotalWithEos') : t('finalSettlementTotalSalaryOnly')}</span>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.finalTotal)}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={SETTLE_SECTION}>
            <div className="bilingual" style={DOC_GRID}>
              <div style={{ ...DOC_BOX, direction: 'ltr', textAlign: 'left' }}>
                <h3 style={DOC_H3}>Employee Declaration</h3>
                <p style={{ lineHeight: 1.45, margin: 0, fontSize: 10.5 }}>
                  I, <strong>{employee?.nameEn || employee?.name || employee?.nameAr || '—'}</strong>, acknowledge receipt of my final dues as per the approved settlement,
                  and confirm that all company property and records in my possession have been returned unless otherwise recorded by the company.
                </p>
                <p style={{ lineHeight: 1.45, marginTop: 8, fontSize: 10.5 }}>
                  <strong>Termination:</strong> {settlementDeclaration.en}
                  <br />
                  <strong>{settlementDeclaration.clauseEn}</strong>
                </p>
              </div>
              <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
              <div style={{ ...DOC_BOX, direction: 'rtl', textAlign: 'right' }}>
                <h3 style={DOC_H3}>إقرار الموظف</h3>
                <p style={{ lineHeight: 1.45, margin: 0, fontSize: 10.5 }}>
                  أقر أنا <strong>{employee?.name || employee?.nameAr || '—'}</strong> بأنني استلمت مستحقاتي النهائية وفق التسوية المعتمدة،
                  وأنني قمت بتسليم ما بعهدتي من ممتلكات أو مستندات تخص الشركة، ما لم يثبت خلاف ذلك في سجل العهد أو المخالصة الداخلية.
                </p>
                <p style={{ lineHeight: 1.45, marginTop: 8, fontSize: 10.5 }}>
                  <strong>بيان إنهاء الخدمة:</strong> {settlementDeclaration.ar}
                  <br />
                  <strong>{settlementDeclaration.clauseAr}</strong>
                </p>
              </div>
            </div>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <div style={{ color: '#64748b', fontSize: 10, textAlign: 'center' }}>تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
            <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: '1fr 1fr 1fr', direction: 'ltr' }}>
              <div className="text-center" style={{ paddingTop: 20, borderTop: '1px solid #cbd5e1', fontSize: 10 }}>HR / الموارد البشرية</div>
              <div className="text-center" style={{ paddingTop: 20, borderTop: '1px solid #cbd5e1', fontSize: 10 }}>Employee / الموظف</div>
              <div className="text-center" style={{ paddingTop: 20, borderTop: '1px solid #cbd5e1', fontSize: 10 }}>Company Approval / اعتماد الشركة</div>
            </div>
          </div>
        </DocumentFrame>
      </div>
    </ModalShell>
  );
}
