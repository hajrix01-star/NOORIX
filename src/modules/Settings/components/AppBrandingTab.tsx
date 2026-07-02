/**
 * AppBrandingTab — إعدادات هوية التطبيق بدعم ثنائي اللغة (عربي / إنجليزي).
 */
import React, { useState, useRef } from 'react';
import { Button, FileInput, Input } from '../../../ui';
import {
  getBrandNameAr, getBrandNameEn,
  getBrandTaglineAr, getBrandTaglineEn,
  getBrandLogo, getBrandColor,
  saveBranding,
  getResolvedLoginEmailDomain,
} from '../../../utils/appBranding';

const SECTION_TITLE_CLS = 'text-[13px] font-bold text-noorix-text mb-3 pb-2 border-b border-noorix-border';

export default function AppBrandingTab() {
  const [nameAr,      setNameAr]      = useState(getBrandNameAr);
  const [nameEn,      setNameEn]      = useState(getBrandNameEn);
  const [taglineAr,   setTaglineAr]   = useState(getBrandTaglineAr);
  const [taglineEn,   setTaglineEn]   = useState(getBrandTaglineEn);
  const [logoUrl,     setLogoUrl]     = useState(getBrandLogo);
  const [color,       setColor]       = useState(getBrandColor);
  const [saved,       setSaved]       = useState(false);
  const fileRef = useRef<any>(null);
  const officialLoginDomain = getResolvedLoginEmailDomain();

  const handleFile = (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev: any) => setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    saveBranding({
      nameAr:      nameAr.trim()      || undefined,
      nameEn:      nameEn.trim()      || undefined,
      taglineAr:   taglineAr.trim()   || undefined,
      taglineEn:   taglineEn.trim()   || undefined,
      logoUrl:     logoUrl.trim()     || undefined,
      color,
      loginDomain: '',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    saveBranding({ nameAr: '', nameEn: '', taglineAr: '', taglineEn: '', logoUrl: '', color: '', loginDomain: '' });
    setNameAr('نووريكس');
    setNameEn('Noorix');
    setTaglineAr('نظام إدارة متكامل');
    setTaglineEn('Business Management System');
    setLogoUrl('');
    setColor('var(--noorix-navy)');
  };

  return (
    <div className="grid w-full min-w-0 max-w-[620px] gap-7">

      {/* ── توضيح المستويات الثلاثة ──────────────────────────────────────── */}
      <div className="rounded-xl text-[12px] text-noorix-muted grid gap-1.5 p-[14px] bg-[var(--noorix-blue-6)] border border-[var(--noorix-blue-15)]">
        <div className="font-bold text-noorix-text mb-0.5">كيف تعمل الهويات؟</div>
        <div>• <strong>هوية التطبيق (هنا)</strong>: الاسم والشعار العام للنظام — يظهر في تبويب المتصفح، أيقونة PWA، وأعلى الشريط الجانبي.</div>
        <div>• <strong>شعار الشركة</strong> (إدارة الشركات): يظهر بجانب اسم الشركة النشطة في الشريط الجانبي وفي الفواتير والتقارير. لا يؤثر على أيقونة المتصفح.</div>
        <div>• <strong>إذا لم تضع شعار للتطبيق</strong>، يظهر الحرف الأول من اسم التطبيق كأيقونة في الشريط.</div>
        <div>• <strong>تسجيل الدخول القصير</strong>: يُبنى البريد كـ <span className="font-mono nx-ltr">اسم@نطاق-رسمي</span> حيث النطاق ثابت من إعداد النشر (يطابق الخادم) — لا يُعدَّل من هذه الشاشة.</div>
      </div>

      {/* ── معاينة ────────────────────────────────────────────────────────── */}
      <div className="p-5 bg-noorix-bg-muted rounded-2xl border border-noorix-border">
        <div className="text-[11px] font-bold text-noorix-muted mb-[14px] uppercase tracking-[0.8px]">
          معاينة مباشرة
        </div>
        <div className="flex items-center flex flex-wrap gap-4">
          {/* أيقونة */}
          <div className="overflow-hidden w-14 h-14 rounded-[14px] shrink-0 flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.18)]" style={{ background: color }}>
            {logoUrl
              ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              : <span className="font-extrabold text-[22px] text-white">{nameAr?.[0] || 'ن'}</span>
            }
          </div>
          {/* نصوص */}
          <div className="grid gap-1 flex-1 min-w-0">
            <div className="flex gap-2.5 flex flex-wrap items-baseline">
              <span dir="rtl" className="text-[16px] font-extrabold text-noorix-text">{nameAr || 'نووريكس'}</span>
              <span className="text-[12px] text-noorix-muted">·</span>
              <span className="text-[13px] font-semibold text-noorix-text nx-ltr">{nameEn || 'Noorix'}</span>
            </div>
          <div className="flex flex flex-wrap gap-2">
            <span dir="rtl" className="text-[12px] text-noorix-muted">{taglineAr || 'الجملة بالعربي'}</span>
              <span className="text-[12px] text-noorix-muted">·</span>
              <span dir="ltr" className="text-[12px] text-noorix-muted">{taglineEn || 'English tagline'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── الاسم ─────────────────────────────────────────────────────────── */}
      <div>
        <div className={SECTION_TITLE_CLS}>اسم التطبيق</div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))]">
          <Input
            type="text"
            label="بالعربي"
            value={nameAr}
            onChange={(e: any) => setNameAr(e.target.value)}
            placeholder="نووريكس"
            maxLength={40}
          />
          <Input
            type="text"
            label="In English"
            value={nameEn}
            onChange={(e: any) => setNameEn(e.target.value)}
            placeholder="Noorix"
            maxLength={40}
          />
        </div>
        <div className="text-[11px] text-noorix-muted mt-1.5">
          يظهر في تبويب المتصفح وأعلى القائمة الجانبية حسب لغة التطبيق
        </div>
      </div>

      {/* ── الجملة التعريفية ──────────────────────────────────────────────── */}
      <div>
        <div className={SECTION_TITLE_CLS}>الجملة التعريفية (تحت الاسم)</div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))]">
          <Input
            type="text"
            label="بالعربي"
            value={taglineAr}
            onChange={(e: any) => setTaglineAr(e.target.value)}
            placeholder="نظام إدارة متكامل"
            maxLength={60}
          />
          <Input
            type="text"
            label="In English"
            value={taglineEn}
            onChange={(e: any) => setTaglineEn(e.target.value)}
            placeholder="Business Management System"
            maxLength={60}
          />
        </div>
        <div className="text-[11px] text-noorix-muted mt-1.5">
          تظهر أسفل الاسم في القائمة الجانبية وفي تذييلها
        </div>
      </div>

      {/* ── الشعار ────────────────────────────────────────────────────────── */}
      <div>
        <div className={SECTION_TITLE_CLS}>شعار التطبيق (الأيقونة)</div>
        <div className="flex gap-3.5 items-start">
          <div className="flex items-center justify-center bg-noorix-bg-muted overflow-hidden w-[72px] h-[72px] rounded-2xl shrink-0 border-2 border-dashed border-noorix-border">
            {logoUrl
              ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              : <span className="text-noorix-muted text-[28px]">—</span>
            }
          </div>
          <div className="flex-1 min-w-0 grid gap-2">
            <Input
              type="url"
              value={logoUrl}
              onChange={(e: any) => setLogoUrl(e.target.value)}
              placeholder="https://رابط-الشعار.com/logo.png"
            />
            <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>
              رفع صورة من الجهاز
            </Button>
            <FileInput ref={fileRef} accept="image/*" onChange={handleFile} className="hidden" />
            {logoUrl && (
              <Button type="button" size="sm" variant="danger" onClick={() => setLogoUrl('')}>
                ✕ إزالة الشعار
              </Button>
            )}
          </div>
        </div>
        <div className="text-[11px] text-noorix-muted mt-2">
          مقاس مقترح: 512×512 بكسل. يستخدم نفس الشعار لكلا اللغتين.
        </div>
      </div>

      {/* ── نطاق البريد الرسمي (قراءة فقط — مطابق للخادم) ─────────────────── */}
      <div>
        <div className={SECTION_TITLE_CLS}>نطاق البريد الرسمي (تسجيل الدخول القصير وإنشاء المستخدم)</div>
        <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted px-3.5 py-3 text-[15px] font-bold text-noorix-text nx-ltr break-all">
          @{officialLoginDomain}
        </div>
        <p className="text-[11px] text-noorix-muted mt-1.5 m-0 leading-relaxed">
          عند إنشاء مستخدم بدون بريد يدوي، أو عند إدخال اسم مستخدم فقط في صفحة الدخول، يُستخدم <strong>هذا النطاق فقط</strong> بحيث يطابق{' '}
          <span className="font-mono text-[11px]">OFFICIAL_EMAIL_DOMAIN</span> في الخادم و
          <span className="font-mono text-[11px]"> VITE_OFFICIAL_EMAIL_DOMAIN </span>
          في بناء الواجهة. الجزء المحلي يُخزَّن بحروف صغيرة (مثال: مستخدم باسم KHALED →{' '}
          <span className="font-mono whitespace-nowrap">khaled@{officialLoginDomain}</span>).
        </p>
      </div>

      {/* ── لون الهوية ────────────────────────────────────────────────────── */}
      <div>
        <div className={SECTION_TITLE_CLS}>لون هوية التطبيق</div>
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <Input
            type="color"
            value={color}
            onChange={(e: any) => setColor(e.target.value)}
            className="cursor-pointer bg-noorix-surface w-12 h-[42px] p-[3px] rounded-[10px] border border-noorix-border shrink-0"
          />
          <Input
            type="text"
            value={color}
            onChange={(e: any) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setColor(e.target.value)}
            className="text-[13px] w-full min-w-0 max-w-[7.5rem] font-mono"
            placeholder="#0a1f44"
            maxLength={7}
          />
          <span className="text-[12px] text-noorix-muted min-w-0 basis-full sm:basis-auto sm:shrink">
            يظهر في شريط العنوان على Android والـ PWA
          </span>
        </div>
      </div>

      {/* ── أزرار ─────────────────────────────────────────────────────────── */}
      <div className="nx-toolbar">
        <Button type="button" size="sm" variant="primary" onClick={handleSave}>
          {saved ? '✓ تم الحفظ' : 'حفظ وتطبيق'}
        </Button>
        <Button type="button" size="sm" onClick={handleReset}>
          إعادة الضبط الافتراضي
        </Button>
      </div>

      {/* ── ملاحظة PWA ────────────────────────────────────────────────────── */}
      <div className="rounded-xl text-[13px] text-noorix-muted p-3.5 bg-[var(--noorix-blue-6)] border border-[var(--noorix-blue-15)] leading-[1.7]">
        <strong className="text-noorix-blue">ملاحظة PWA:</strong>
        <br />
        التغييرات تُطبَّق فوراً على تبويب المتصفح والأيقونة. إذا كان التطبيق مثبّتاً على الجوال، قد تحتاج لإضافته مجدداً للحصول على الأيقونة المحدّثة.
      </div>
    </div>
  );
}
