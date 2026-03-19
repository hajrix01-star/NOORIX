/**
 * EmployeeDocModal — وثائق الموظف الاحترافية (ثنائية اللغة)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import Decimal from 'decimal.js';
import { uploadDocumentFile } from '../../../services/api';
import { parseEmployeeNotesMeta } from '../utils/employeeNotesMeta';

const SAUDI_STANDARD_HOURS = 8;
const SAUDI_DAYS_PER_MONTH = 30;
const WORK_DAYS_PER_MONTH = 26;
const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWANCE_NAME_EN_MAP = {
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

function parseWorkHours(str) {
  if (!str) return SAUDI_STANDARD_HOURS;
  const m = String(str).match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.min(12, parseFloat(m[1]))) : SAUDI_STANDARD_HOURS;
}

function translateAllowanceToEnglish(nameAr = '') {
  const normalized = String(nameAr || '').trim();
  if (!normalized) return 'Allowance';
  if (ALLOWANCE_NAME_EN_MAP[normalized]) return ALLOWANCE_NAME_EN_MAP[normalized];
  const compact = normalized.replace(/\s+/g, ' ');
  if (ALLOWANCE_NAME_EN_MAP[compact]) return ALLOWANCE_NAME_EN_MAP[compact];
  return 'Custom Allowance';
}

function calculateServiceDays(joinDate, endDate) {
  const start = new Date(joinDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function getEligibilityFactor(reason, serviceYears) {
  if (reason === 'article80') return new Decimal(0);
  if (reason === 'employer' || reason === 'article81') return new Decimal(1);
  if (serviceYears < 2) return new Decimal(0);
  if (serviceYears < 5) return new Decimal(1).div(3);
  if (serviceYears < 10) return new Decimal(2).div(3);
  return new Decimal(1);
}

function mapReasonByMeta(reasonText = '', clause = '') {
  const reason = String(reasonText || '').toLowerCase();
  const legalClause = String(clause || '').toLowerCase();
  if (legalClause.includes('80') || reason.includes('80')) return 'article80';
  if (legalClause.includes('81') || reason.includes('81')) return 'article81';
  if (reason.includes('استقال') || reason.includes('resign')) return 'resignation';
  return 'employer';
}

function buildSalaryRows(employee, customAllowances = []) {
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
  const actualWage = rows.reduce((sum, row) => sum + row.amount, 0);
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(employee?.workHours) - SAUDI_STANDARD_HOURS);
  if (overtimeHoursPerDay > 0) {
    const actualHourlyRate = new Decimal(actualWage).div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
    const basicHourlyRate = basic.div(SAUDI_DAYS_PER_MONTH).div(SAUDI_STANDARD_HOURS);
    const overtimeAmount = actualHourlyRate.plus(basicHourlyRate.times(0.5)).times(overtimeHoursPerDay).times(WORK_DAYS_PER_MONTH).toNumber();
    rows.push({ ar: `مقابل الأوفر تايم (${fmt(overtimeHoursPerDay)} ساعة/يوم)`, en: `Overtime Pay (${fmt(overtimeHoursPerDay)} hr/day)`, amount: overtimeAmount });
  }
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return { rows, total };
}

function buildPrintableHtml(title, html) {
  return `<!DOCTYPE html>
  <html dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>
        body{font-family:'Cairo',Arial,sans-serif;padding:24px;background:#fff;color:#111;max-width:960px;margin:0 auto;line-height:1.6}
        .doc{border:1px solid #d6dbe3;border-radius:14px;overflow:hidden}
        .header{padding:18px 22px;border-bottom:2px solid #0f172a;background:#f8fafc}
        .title{font-size:22px;font-weight:800;text-align:center;margin:0}
        .subtitle{font-size:13px;text-align:center;color:#475569;margin-top:6px}
        .section{padding:18px 22px;border-bottom:1px solid #e5e7eb}
        .section:last-child{border-bottom:none}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .bilingual{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
        .box{padding:14px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
        .box h3{margin:0 0 10px;font-size:15px}
        .box p,.box li{margin:0 0 8px;line-height:1.7;font-size:13px}
        table{width:100%;border-collapse:collapse}
        th,td{padding:10px 12px;border:1px solid #dbe1e8;font-size:13px}
        th{background:#f8fafc}
        .num{text-align:left;font-family:'Cairo',Arial,sans-serif}
        .footer{padding:18px 22px}
        .signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:20px}
        .sig{padding-top:36px;border-top:1px solid #cbd5e1;font-size:13px}
        @media print{body{padding:0}.doc{border:none;border-radius:0}}
      </style>
    </head>
    <body>${html}</body>
  </html>`;
}

async function renderPdfFileFromElement(element, fileBaseName) {
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

function buildPrintWindow(title, html) {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.write(buildPrintableHtml(title, html));
  win.document.close();
  win.focus();
  return win;
}

function ModalShell({ title, children, onClose, onPrint, onSave, saving, t }) {
  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div className="noorix-surface-card" style={{ padding: 24, maxWidth: 920, width: '96%', maxHeight: '92vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{title}</h3>
        {children}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
          <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('close')}</button>
          <button type="button" className="noorix-btn-nav" onClick={onPrint}>{t('print') || 'طباعة'}</button>
          <button type="button" className="noorix-btn-nav" style={{ background: 'var(--btn-primary-bg)', color: '#fff' }} disabled={saving} onClick={onSave}>
            {saving ? t('saving') : (t('saveToDocuments') || 'حفظ في المستندات')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentFrame({ companyName, companyLogo, arabicTitle, englishTitle, children }) {
  return (
    <div className="doc" style={{ border: '1px solid var(--noorix-border)', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      <div style={{ padding: '18px 22px', borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
        {companyLogo ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <img src={companyLogo} alt="company-logo" style={{ maxHeight: 56, objectFit: 'contain' }} />
          </div>
        ) : null}
        <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 800 }}>{companyName || 'الشركة'}</div>
        <div style={{ textAlign: 'center', marginTop: 6, color: '#475569' }}>{companyName || 'Company'}</div>
        <div style={{ textAlign: 'center', marginTop: 14, fontWeight: 800 }}>{arabicTitle}</div>
        <div style={{ textAlign: 'center', color: '#475569', marginTop: 4 }}>{englishTitle}</div>
        <div style={{ textAlign: 'center', marginTop: 4, color: '#64748b', fontSize: 12 }}>
          التاريخ / Date: {formatSaudiDate(new Date())}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmployeeInfoTable({ employee, workHoursValue }) {
  const infoRows = [
    ['اسم الموظف', 'Employee Name', employee?.name || employee?.nameAr || '—'],
    ['المسمى الوظيفي', 'Job Title', employee?.jobTitle || '—'],
    ['رقم الإقامة', 'Iqama Number', employee?.iqamaNumber || '—'],
    ['تاريخ التعيين', 'Join Date', formatSaudiDate(employee?.joinDate)],
    ['ساعات العمل', 'Working Hours', workHoursValue || employee?.workHours || '8'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 12, alignItems: 'stretch' }}>
      <table>
        <thead>
          <tr>
            <th>العنصر</th>
            <th>البيان</th>
          </tr>
        </thead>
        <tbody>
          {infoRows.map(([ar, _en, value]) => (
            <tr key={ar}>
              <td>{ar}</td>
              <td className="num">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ background: '#cbd5e1', borderRadius: 999 }} />
      <table style={{ direction: 'ltr' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Item</th>
            <th style={{ textAlign: 'left' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {infoRows.map(([_ar, en, value]) => (
            <tr key={en}>
              <td style={{ textAlign: 'left' }}>{en}</td>
              <td className="num" style={{ textAlign: 'right' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalaryBreakdownTable({ rows, total }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 12, alignItems: 'stretch' }}>
      <table>
        <thead>
          <tr>
            <th>المكون</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`ar-${row.ar}-${idx}`}>
              <td>{row.ar}</td>
              <td className="num">{fmt(row.amount)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 800 }}>إجمالي الراتب</td>
            <td className="num" style={{ fontWeight: 800 }}>{fmt(total)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ background: '#cbd5e1', borderRadius: 999 }} />
      <table style={{ direction: 'ltr' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Component</th>
            <th style={{ textAlign: 'left' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`en-${row.en}-${idx}`}>
              <td style={{ textAlign: 'left' }}>{row.en}</td>
              <td className="num" style={{ textAlign: 'right' }}>{fmt(row.amount, 2)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 800, textAlign: 'left' }}>Total Compensation</td>
            <td className="num" style={{ fontWeight: 800, textAlign: 'right' }}>{fmt(total, 2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

async function uploadRenderedDocument({ companyId, employeeId, documentType, fileBaseName, html }) {
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

function buildDocFileBaseName(prefix, employee) {
  const employeeName = employee?.name || employee?.nameAr || 'employee';
  const datePart = formatSaudiDate(new Date()).replace(/\//g, '-');
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${prefix}-${employeeName}-${datePart}-${hh}-${mm}-${ss}`;
}

function getTerminationSummary(employee) {
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

export function SalaryCertificateModal({ employee, customAllowances = [], companyId, companyName, companyLogo, onClose, onSaved }) {
  const { t } = useTranslation();
  const printRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const { rows, total } = useMemo(() => buildSalaryRows(employee, customAllowances), [employee, customAllowances]);

  const handlePrint = () => {
    const win = buildPrintWindow(t('salaryCertificate') || 'Salary Certificate', printRef.current?.innerHTML || '');
    if (!win) {
      alert(t('allowPopupsForPrint') || 'يرجى السماح بالنوافذ المنبثقة للموقع ثم المحاولة مرة أخرى');
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
      if (!res?.success) throw new Error(res?.error || 'فشل الحفظ');
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(err?.message || 'فشل حفظ المستند');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={t('salaryCertificate') || 'شهادة تعريف راتب'} onClose={onClose} onPrint={handlePrint} onSave={handleSaveToDocuments} saving={saving} t={t}>
      <div ref={printRef}>
        <DocumentFrame companyName={companyName} companyLogo={companyLogo} arabicTitle="شهادة تعريف راتب" englishTitle="Employment & Salary Certificate">
          <div className="section" style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <div className="bilingual" style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 18, alignItems: 'stretch' }}>
              <div style={{ padding: 14, border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
                <h3 style={{ margin: '0 0 10px' }}>إفادة</h3>
                <p style={{ lineHeight: 1.8, margin: 0 }}>
                  تشهد الشركة بأن الموظف/ة <strong>{employee?.name || employee?.nameAr || '—'}</strong> يعمل/تعمل لدينا بوظيفة
                  <strong> {employee?.jobTitle || '—'}</strong> منذ تاريخ <strong>{formatSaudiDate(employee?.joinDate)}</strong>
                  ، وما زال/تزال على رأس العمل حتى تاريخ إصدار هذه الشهادة.
                </p>
              </div>
              <div style={{ background: '#cbd5e1', borderRadius: 999 }} />
              <div style={{ padding: 14, border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
                <h3 style={{ margin: '0 0 10px' }}>Certification</h3>
                <p style={{ lineHeight: 1.8, margin: 0 }}>
                  This is to certify that <strong>{employee?.name || employee?.nameAr || '—'}</strong> is employed by the company as
                  <strong> {employee?.jobTitle || '—'}</strong> since <strong>{formatSaudiDate(employee?.joinDate)}</strong> and remains employed as of the issue date of this certificate.
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

export function ContractModal({ employee, customAllowances = [], companyId, companyName, companyLogo, onClose, onSaved }) {
  const { t } = useTranslation();
  const printRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const { rows, total } = useMemo(() => buildSalaryRows(employee, customAllowances), [employee, customAllowances]);

  const handlePrint = () => {
    const win = buildPrintWindow(t('documentContract') || 'Employment Contract', printRef.current?.innerHTML || '');
    if (!win) {
      alert(t('allowPopupsForPrint') || 'يرجى السماح بالنوافذ المنبثقة للموقع ثم المحاولة مرة أخرى');
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
      if (!res?.success) throw new Error(res?.error || 'فشل الحفظ');
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(err?.message || 'فشل حفظ المستند');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={t('documentContract') || 'عقد عمل'} onClose={onClose} onPrint={handlePrint} onSave={handleSaveToDocuments} saving={saving} t={t}>
      <div ref={printRef}>
        <DocumentFrame companyName={companyName} companyLogo={companyLogo} arabicTitle="عقد عمل" englishTitle="Employment Contract">
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <EmployeeInfoTable employee={employee} workHoursValue="8 ساعات أساسية / 8 regular hours" />
          </div>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <SalaryBreakdownTable rows={rows} total={total} />
          </div>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 18, alignItems: 'stretch' }}>
              <div style={{ padding: 14, border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
                <h3 style={{ margin: '0 0 10px' }}>بنود أساسية</h3>
                <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.9 }}>
                  <li>تم تعيين الموظف في وظيفة {employee?.jobTitle || '—'}.</li>
                  <li>يكون مكان العمل حسب متطلبات الشركة وتعليماتها التنظيمية.</li>
                  <li>ساعات العمل الأساسية 8 ساعات يومياً، وأي ساعات إضافية فوق ذلك تعد أوفر تايم وتحسب وفق نظام العمل السعودي وبعد موافقة الموظف.</li>
                  <li>يتقاضى الموظف التعويضات الثابتة الموضحة في كشف الراتب الملحق بهذا العقد.</li>
                  <li>تطبق على هذا العقد أنظمة العمل المعمول بها في المملكة العربية السعودية.</li>
                </ol>
              </div>
              <div style={{ background: '#cbd5e1', borderRadius: 999 }} />
              <div style={{ padding: 14, border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
                <h3 style={{ margin: '0 0 10px' }}>Key Terms</h3>
                <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.9 }}>
                  <li>The employee is appointed as {employee?.jobTitle || '—'}.</li>
                  <li>The work location shall be as assigned by the company according to operational needs.</li>
                  <li>Regular working hours are 8 hours per day. Any hours above that are treated as overtime, subject to employee approval and Saudi Labor Law.</li>
                  <li>The employee shall receive the fixed compensation listed in the salary breakdown attached to this contract.</li>
                  <li>This contract is governed by the applicable labor laws of the Kingdom of Saudi Arabia.</li>
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

export function FinalSettlementModal({ employee, customAllowances = [], companyId, companyName, companyLogo, onClose, onSaved }) {
  const { t } = useTranslation();
  const printRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [includeEos, setIncludeEos] = useState(true);
  const { rows, total } = useMemo(() => buildSalaryRows(employee, customAllowances), [employee, customAllowances]);
  const lastMonthlyComp = total;
  const termination = useMemo(() => getTerminationSummary(employee), [employee]);
  const [eosEndDate, setEosEndDate] = useState(termination.terminationDate || new Date().toISOString().slice(0, 10));
  const [eosReason, setEosReason] = useState(termination.reasonCode || 'employer');
  const [eosSalary, setEosSalary] = useState(String(lastMonthlyComp || 0));
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(employee?.workHours) - SAUDI_STANDARD_HOURS);

  useEffect(() => {
    setEosEndDate(termination.terminationDate || new Date().toISOString().slice(0, 10));
    setEosReason(termination.reasonCode || 'employer');
    setEosSalary(String(lastMonthlyComp || 0));
  }, [termination.terminationDate, termination.reasonCode, lastMonthlyComp]);
  const eos = useMemo(() => {
    const endDate = eosEndDate || termination.terminationDate || new Date().toISOString().slice(0, 10);
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

  const handlePrint = () => {
    const win = buildPrintWindow(t('finalSettlement') || 'Final Settlement', printRef.current?.innerHTML || '');
    if (!win) {
      alert(t('allowPopupsForPrint') || 'يرجى السماح بالنوافذ المنبثقة للموقع ثم المحاولة مرة أخرى');
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
      if (!res?.success) throw new Error(res?.error || 'فشل الحفظ');
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(err?.message || 'فشل حفظ المستند');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={t('finalSettlement') || 'مخالصة نهائية'} onClose={onClose} onPrint={handlePrint} onSave={handleSaveToDocuments} saving={saving} t={t}>
      <div ref={printRef}>
        <DocumentFrame companyName={companyName} companyLogo={companyLogo} arabicTitle="مخالصة وتسوية نهائية" englishTitle="Final Settlement & Clearance">
          <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--noorix-border)', background: '#f8fafc' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={includeEos} onChange={(e) => setIncludeEos(e.target.checked)} />
              {includeEos ? t('includeEosInSettlement') : t('excludeEosInSettlement')}
            </label>
          </div>
          <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--noorix-border)', background: '#f8fafc' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>حاسبة نهاية الخدمة (تفصيل قبل الطباعة) / EOS Calculator (before print)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>تاريخ نهاية الخدمة</label>
                <input type="date" value={eosEndDate} onChange={(e) => setEosEndDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>سبب الانتهاء</label>
                <select value={eosReason} onChange={(e) => setEosReason(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}>
                  <option value="employer">{t('eosCalcReasonEmployer')}</option>
                  <option value="resignation">{t('eosCalcReasonResignation')}</option>
                  <option value="article81">{t('eosCalcReasonArticle81')}</option>
                  <option value="article80">{t('eosCalcReasonArticle80')}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>الأجر المعتمد لنهاية الخدمة</label>
                <input type="number" min="0" step="0.01" value={eosSalary} onChange={(e) => setEosSalary(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)' }} />
              </div>
            </div>
          </div>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <EmployeeInfoTable employee={employee} />
          </div>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <SalaryBreakdownTable rows={rows} total={lastMonthlyComp} />
          </div>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 18, alignItems: 'stretch' }}>
              <div style={{ padding: 14, border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
                <h3 style={{ margin: '0 0 10px' }}>حسبة المستحقات النهائية</h3>
                <div style={{ lineHeight: 1.9, fontSize: 13 }}>
                  <div><strong>مدة الخدمة (يوم):</strong> {eos.serviceDays}</div>
                  <div><strong>مدة الخدمة (سنة):</strong> {fmt(eos.serviceYears)}</div>
                  <div><strong>ساعات العمل اليومية:</strong> {fmt(parseWorkHours(employee?.workHours))}</div>
                  <div><strong>ساعات الأوفرتايم اليومية:</strong> {fmt(overtimeHoursPerDay)}</div>
                  <div><strong>الأجر المعتمد للحسبة:</strong> {fmt(eos.wageForEos)}</div>
                  <div><strong>مكافأة نهاية الخدمة الكاملة:</strong> {fmt(eos.fullAward)}</div>
                  <div><strong>نسبة الاستحقاق:</strong> {fmt(eos.factorPct)}%</div>
                  <div><strong>قيمة نهاية الخدمة حسب النظام:</strong> {fmt(eos.eosAmount)}</div>
                  <div><strong>القيمة المضافة في المخالصة:</strong> {fmt(eos.appliedEosAmount)}</div>
                  <div><strong>إجمالي التسوية (راتب + نهاية خدمة):</strong> {fmt(eos.finalTotal)}</div>
                </div>
              </div>
              <div style={{ background: '#cbd5e1', borderRadius: 999 }} />
              <div style={{ padding: 14, border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
                <h3 style={{ margin: '0 0 10px' }}>Final Entitlements Calculation</h3>
                <div style={{ lineHeight: 1.9, fontSize: 13 }}>
                  <div><strong>Service period (days):</strong> {eos.serviceDays}</div>
                  <div><strong>Service period (years):</strong> {fmt(eos.serviceYears)}</div>
                  <div><strong>Work hours/day:</strong> {fmt(parseWorkHours(employee?.workHours))}</div>
                  <div><strong>Overtime hours/day:</strong> {fmt(overtimeHoursPerDay)}</div>
                  <div><strong>Wage used for EOS:</strong> {fmt(eos.wageForEos)}</div>
                  <div><strong>Full EOS award:</strong> {fmt(eos.fullAward)}</div>
                  <div><strong>Eligibility factor:</strong> {fmt(eos.factorPct)}%</div>
                  <div><strong>EOS amount by law:</strong> {fmt(eos.eosAmount)}</div>
                  <div><strong>Amount included in settlement:</strong> {fmt(eos.appliedEosAmount)}</div>
                  <div><strong>Total settlement (salary + EOS):</strong> {fmt(eos.finalTotal)}</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 18, alignItems: 'stretch' }}>
              <div style={{ padding: 14, border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
                <h3 style={{ margin: '0 0 10px' }}>إقرار الموظف</h3>
                <p style={{ lineHeight: 1.8, margin: 0 }}>
                  أقر أنا <strong>{employee?.name || employee?.nameAr || '—'}</strong> بأنني استلمت مستحقاتي النهائية وفق التسوية المعتمدة،
                  وأنني قمت بتسليم ما بعهدتي من ممتلكات أو مستندات تخص الشركة، ما لم يثبت خلاف ذلك في سجل العهد أو المخالصة الداخلية.
                </p>
                <p style={{ lineHeight: 1.8, marginTop: 10 }}>
                  <strong>بيان إنهاء الخدمة:</strong> {termination.ar}
                  <br />
                  <strong>{termination.clauseAr}</strong>
                </p>
              </div>
              <div style={{ background: '#cbd5e1', borderRadius: 999 }} />
              <div style={{ padding: 14, border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
                <h3 style={{ margin: '0 0 10px' }}>Employee Declaration</h3>
                <p style={{ lineHeight: 1.8, margin: 0 }}>
                  I, <strong>{employee?.name || employee?.nameAr || '—'}</strong>, acknowledge receipt of my final dues as per the approved settlement,
                  and confirm that all company property and records in my possession have been returned unless otherwise recorded by the company.
                </p>
                <p style={{ lineHeight: 1.8, marginTop: 10 }}>
                  <strong>Termination Statement:</strong> {termination.en}
                  <br />
                  <strong>{termination.clauseEn}</strong>
                </p>
              </div>
            </div>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <div style={{ color: '#64748b', fontSize: 12 }}>تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 22 }}>
              <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>الموارد البشرية / HR</div>
              <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>الموظف / Employee</div>
              <div style={{ paddingTop: 32, borderTop: '1px solid #cbd5e1' }}>اعتماد الشركة / Company Approval</div>
            </div>
          </div>
        </DocumentFrame>
      </div>
    </ModalShell>
  );
}
