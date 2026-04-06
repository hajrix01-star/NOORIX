/**
 * AppBrandingTab — إعدادات هوية التطبيق بدعم ثنائي اللغة (عربي / إنجليزي).
 */
import React, { useState, useRef } from 'react';
import { Button, Input } from '../../../ui';
import {
  getBrandNameAr, getBrandNameEn,
  getBrandTaglineAr, getBrandTaglineEn,
  getBrandLogo, getBrandColor, getLoginDomain,
  saveBranding,
} from '../../../utils/appBranding';

const sectionTitle = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--noorix-text)',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid var(--noorix-border)',
};

export default function AppBrandingTab() {
  const [nameAr,      setNameAr]      = useState(getBrandNameAr);
  const [nameEn,      setNameEn]      = useState(getBrandNameEn);
  const [taglineAr,   setTaglineAr]   = useState(getBrandTaglineAr);
  const [taglineEn,   setTaglineEn]   = useState(getBrandTaglineEn);
  const [logoUrl,     setLogoUrl]     = useState(getBrandLogo);
  const [color,       setColor]       = useState(getBrandColor);
  const [loginDomain, setLoginDomain] = useState(getLoginDomain);
  const [saved,       setSaved]       = useState(false);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoUrl(ev.target.result);
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
      loginDomain: loginDomain.trim() || undefined,
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
    setColor('#0a1f44');
    setLoginDomain('noorix.sa');
  };

  return (
    <div className="nx-grid" style={{ gap: 28, maxWidth: 620 }}>

      {/* ── توضيح المستويات الثلاثة ──────────────────────────────────────── */}
      <div className="nx-rounded-lg nx-text-sm nx-text-muted nx-grid nx-gap-6" style={{ padding: 14, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
        <div className="nx-font-700 nx-text-primary" style={{ marginBottom: 2 }}>ℹ️ كيف تعمل الهويات؟</div>
        <div>• <strong>هوية التطبيق (هنا)</strong>: الاسم والشعار العام للنظام — يظهر في تبويب المتصفح، أيقونة PWA، وأعلى الشريط الجانبي.</div>
        <div>• <strong>شعار الشركة</strong> (إدارة الشركات): يظهر بجانب اسم الشركة النشطة في الشريط الجانبي وفي الفواتير والتقارير. لا يؤثر على أيقونة المتصفح.</div>
        <div>• <strong>إذا لم تضع شعار للتطبيق</strong>، يظهر الحرف الأول من اسم التطبيق كأيقونة في الشريط.</div>
      </div>

      {/* ── معاينة ────────────────────────────────────────────────────────── */}
      <div className="nx-p-20 nx-bg-muted" style={{ borderRadius: 16, border: '1px solid var(--noorix-border)' }}>
        <div className="nx-text-xs nx-font-700 nx-text-muted" style={{ marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          معاينة مباشرة
        </div>
        <div className="nx-flex-center nx-flex-wrap nx-gap-16">
          {/* أيقونة */}
          <div className="nx-overflow-hidden" style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          }}>
            {logoUrl
              ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span className="nx-font-800" style={{ fontSize: 22, color: '#fff' }}>{nameAr?.[0] || 'ن'}</span>
            }
          </div>
          {/* نصوص */}
          <div className="nx-grid nx-gap-4 nx-flex-1" style={{ minWidth: 0 }}>
            <div className="nx-flex nx-gap-10 nx-flex-wrap" style={{ alignItems: 'baseline' }}>
              <span className="nx-text-xl nx-font-800 nx-text-primary" style={{ direction: 'rtl' }}>{nameAr || 'نووريكس'}</span>
              <span className="nx-text-sm nx-text-muted">·</span>
              <span className="nx-text-base nx-font-600 nx-text-primary nx-ltr">{nameEn || 'Noorix'}</span>
            </div>
          <div className="nx-flex nx-flex-wrap nx-gap-8">
            <span className="nx-text-sm nx-text-muted" style={{ direction: 'rtl' }}>{taglineAr || 'الجملة بالعربي'}</span>
              <span className="nx-text-sm nx-text-muted">·</span>
              <span className="nx-text-sm nx-text-muted" style={{ direction: 'ltr' }}>{taglineEn || 'English tagline'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── الاسم ─────────────────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>اسم التطبيق</div>
        <div className="nx-grid nx-gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))' }}>
          <Input
            type="text"
            label="بالعربي"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder="نووريكس"
            maxLength={40}
          />
          <Input
            type="text"
            label="In English"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="Noorix"
            maxLength={40}
          />
        </div>
        <div className="nx-text-xs nx-text-muted nx-mt-6">
          يظهر في تبويب المتصفح وأعلى القائمة الجانبية حسب لغة التطبيق
        </div>
      </div>

      {/* ── الجملة التعريفية ──────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>الجملة التعريفية (تحت الاسم)</div>
        <div className="nx-grid nx-gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))' }}>
          <Input
            type="text"
            label="بالعربي"
            value={taglineAr}
            onChange={(e) => setTaglineAr(e.target.value)}
            placeholder="نظام إدارة متكامل"
            maxLength={60}
          />
          <Input
            type="text"
            label="In English"
            value={taglineEn}
            onChange={(e) => setTaglineEn(e.target.value)}
            placeholder="Business Management System"
            maxLength={60}
          />
        </div>
        <div className="nx-text-xs nx-text-muted nx-mt-6">
          تظهر أسفل الاسم في القائمة الجانبية وفي تذييلها
        </div>
      </div>

      {/* ── الشعار ────────────────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>شعار التطبيق (الأيقونة)</div>
        <div className="nx-flex nx-gap-14" style={{ alignItems: 'flex-start' }}>
          <div className="nx-flex-center nx-bg-muted nx-overflow-hidden" style={{
            width: 72, height: 72, borderRadius: 16, flexShrink: 0,
            border: '2px dashed var(--noorix-border)',
            justifyContent: 'center',
          }}>
            {logoUrl
              ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span className="nx-text-muted" style={{ fontSize: 28 }}>—</span>
            }
          </div>
          <div className="nx-flex-1 nx-grid nx-gap-8">
            <Input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://رابط-الشعار.com/logo.png"
            />
            <Button type="button" onClick={() => fileRef.current?.click()}>
              رفع صورة من الجهاز
            </Button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            {logoUrl && (
              <Button type="button" variant="danger" onClick={() => setLogoUrl('')}>
                ✕ إزالة الشعار
              </Button>
            )}
          </div>
        </div>
        <div className="nx-text-xs nx-text-muted nx-mt-8">
          مقاس مقترح: 512×512 بكسل. يستخدم نفس الشعار لكلا اللغتين.
        </div>
      </div>

      {/* ── دومين تسجيل الدخول ────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>دومين النظام (يظهر كتلميح في صفحة الدخول)</div>
        <div className="nx-flex-center" style={{ gap: 0, maxWidth: 320 }}>
          <span className="nx-bg-muted nx-text-base nx-text-muted nx-ltr" style={{
            padding: '10px 12px',
            border: '1px solid var(--noorix-border)', borderRadius: '10px 0 0 10px',
            flexShrink: 0,
          }}>@</span>
          <Input
            type="text"
            value={loginDomain}
            onChange={(e) => setLoginDomain(e.target.value.replace(/^@/, '').replace(/\s/g, ''))}
            placeholder="noorix.sa"
            style={{ borderRadius: '0 10px 10px 0', borderLeft: 'none', direction: 'ltr', textAlign: 'left' }}
            maxLength={60}
          />
        </div>
        <div className="nx-text-xs nx-text-muted nx-mt-6">
          يظهر كتلميح في خانة البريد الإلكتروني بصفحة الدخول. لا يغير الإيميلات المسجّلة فعلياً.
        </div>
      </div>

      {/* ── لون الهوية ────────────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>لون هوية التطبيق</div>
        <div className="nx-flex-center nx-flex-wrap nx-gap-10">
          <Input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="nx-cursor-pointer nx-bg-surface"
            style={{ width: 48, height: 42, padding: 3, borderRadius: 10, border: '1px solid var(--noorix-border)', flexShrink: 0 }}
          />
          <Input
            type="text"
            value={color}
            onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setColor(e.target.value)}
            className="nx-text-base"
            style={{ width: 100, minWidth: 0, fontFamily: 'monospace' }}
            placeholder="#0a1f44"
            maxLength={7}
          />
          <span className="nx-text-sm nx-text-muted" style={{ flexShrink: 1 }}>يظهر في شريط العنوان على Android والـ PWA</span>
        </div>
      </div>

      {/* ── أزرار ─────────────────────────────────────────────────────────── */}
      <div className="nx-toolbar">
        <Button type="button" variant="primary" onClick={handleSave}>
          {saved ? '✓ تم الحفظ' : 'حفظ وتطبيق'}
        </Button>
        <Button type="button" onClick={handleReset}>
          إعادة الضبط الافتراضي
        </Button>
      </div>

      {/* ── ملاحظة PWA ────────────────────────────────────────────────────── */}
      <div className="nx-rounded-lg nx-text-base nx-text-muted nx-p-14" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--noorix-accent-blue)' }}>ℹ ملاحظة PWA:</strong>
        <br />
        التغييرات تُطبَّق فوراً على تبويب المتصفح والأيقونة. إذا كان التطبيق مثبّتاً على الجوال، قد تحتاج لإضافته مجدداً للحصول على الأيقونة المحدّثة.
      </div>
    </div>
  );
}
