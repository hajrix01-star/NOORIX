/**
 * AppBrandingTab — إعدادات هوية التطبيق بدعم ثنائي اللغة (عربي / إنجليزي).
 */
import React, { useState, useRef } from 'react';
import {
  getBrandNameAr, getBrandNameEn,
  getBrandTaglineAr, getBrandTaglineEn,
  getBrandLogo, getBrandColor, getLoginDomain,
  saveBranding,
} from '../../../utils/appBranding';

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--noorix-border)',
  background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)',
  fontSize: 14,
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--noorix-text-muted)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
};

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
    <div style={{ display: 'grid', gap: 28, maxWidth: 620 }}>

      {/* ── توضيح المستويات الثلاثة ──────────────────────────────────────── */}
      <div style={{ padding: 14, borderRadius: 12, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', fontSize: 12, color: 'var(--noorix-text-muted)', display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 700, color: 'var(--noorix-text)', marginBottom: 2 }}>ℹ️ كيف تعمل الهويات؟</div>
        <div>• <strong>هوية التطبيق (هنا)</strong>: الاسم والشعار العام للنظام — يظهر في تبويب المتصفح، أيقونة PWA، وأعلى الشريط الجانبي.</div>
        <div>• <strong>شعار الشركة</strong> (إدارة الشركات): يظهر بجانب اسم الشركة النشطة في الشريط الجانبي وفي الفواتير والتقارير. لا يؤثر على أيقونة المتصفح.</div>
        <div>• <strong>إذا لم تضع شعار للتطبيق</strong>، يظهر الحرف الأول من اسم التطبيق كأيقونة في الشريط.</div>
      </div>

      {/* ── معاينة ────────────────────────────────────────────────────────── */}
      <div style={{ padding: 20, borderRadius: 16, background: 'var(--noorix-bg-muted)', border: '1px solid var(--noorix-border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--noorix-text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          معاينة مباشرة
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* أيقونة */}
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            background: color, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          }}>
            {logoUrl
              ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 22, color: '#fff', fontWeight: 800 }}>{nameAr?.[0] || 'ن'}</span>
            }
          </div>
          {/* نصوص */}
          <div style={{ display: 'grid', gap: 4, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--noorix-text)', direction: 'rtl' }}>{nameAr || 'نووريكس'}</span>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>·</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--noorix-text)', direction: 'ltr' }}>{nameEn || 'Noorix'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', direction: 'rtl' }}>{taglineAr || 'الجملة بالعربي'}</span>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', direction: 'ltr' }}>{taglineEn || 'English tagline'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── الاسم ─────────────────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>اسم التطبيق</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 }}>
          <div>
            <label style={{ ...labelStyle, direction: 'rtl' }}>بالعربي</label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="نووريكس"
              style={{ ...inputStyle, direction: 'rtl', textAlign: 'right' }}
              maxLength={40}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, direction: 'ltr' }}>In English</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Noorix"
              style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }}
              maxLength={40}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 6 }}>
          يظهر في تبويب المتصفح وأعلى القائمة الجانبية حسب لغة التطبيق
        </div>
      </div>

      {/* ── الجملة التعريفية ──────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>الجملة التعريفية (تحت الاسم)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 }}>
          <div>
            <label style={{ ...labelStyle, direction: 'rtl' }}>بالعربي</label>
            <input
              type="text"
              value={taglineAr}
              onChange={(e) => setTaglineAr(e.target.value)}
              placeholder="نظام إدارة متكامل"
              style={{ ...inputStyle, direction: 'rtl', textAlign: 'right' }}
              maxLength={60}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, direction: 'ltr' }}>In English</label>
            <input
              type="text"
              value={taglineEn}
              onChange={(e) => setTaglineEn(e.target.value)}
              placeholder="Business Management System"
              style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }}
              maxLength={60}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 6 }}>
          تظهر أسفل الاسم في القائمة الجانبية وفي تذييلها
        </div>
      </div>

      {/* ── الشعار ────────────────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>شعار التطبيق (الأيقونة)</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 16, flexShrink: 0,
            border: '2px dashed var(--noorix-border)',
            background: 'var(--noorix-bg-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {logoUrl
              ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, color: 'var(--noorix-text-muted)' }}>—</span>
            }
          </div>
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://رابط-الشعار.com/logo.png"
              style={{ ...inputStyle, fontSize: 13 }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                padding: '9px 16px', borderRadius: 10,
                border: '1px solid var(--noorix-border)',
                background: 'var(--noorix-bg-surface)',
                color: 'var(--noorix-text)',
                fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              رفع صورة من الجهاز
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl('')}
                style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', padding: 0 }}
              >
                ✕ إزالة الشعار
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 8 }}>
          مقاس مقترح: 512×512 بكسل. يستخدم نفس الشعار لكلا اللغتين.
        </div>
      </div>

      {/* ── دومين تسجيل الدخول ────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>دومين النظام (يظهر كتلميح في صفحة الدخول)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: 320 }}>
          <span style={{
            padding: '10px 12px', background: 'var(--noorix-bg-muted)',
            border: '1px solid var(--noorix-border)', borderRadius: '10px 0 0 10px',
            fontSize: 13, color: 'var(--noorix-text-muted)', flexShrink: 0, direction: 'ltr',
          }}>@</span>
          <input
            type="text"
            value={loginDomain}
            onChange={(e) => setLoginDomain(e.target.value.replace(/^@/, '').replace(/\s/g, ''))}
            placeholder="noorix.sa"
            style={{ ...inputStyle, borderRadius: '0 10px 10px 0', borderLeft: 'none', direction: 'ltr', textAlign: 'left' }}
            maxLength={60}
          />
        </div>
        <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 6 }}>
          يظهر كتلميح في خانة البريد الإلكتروني بصفحة الدخول. لا يغير الإيميلات المسجّلة فعلياً.
        </div>
      </div>

      {/* ── لون الهوية ────────────────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>لون هوية التطبيق</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 48, height: 42, padding: 3, borderRadius: 10, border: '1px solid var(--noorix-border)', cursor: 'pointer', background: 'var(--noorix-bg-surface)', flexShrink: 0 }}
          />
          <input
            type="text"
            value={color}
            onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setColor(e.target.value)}
            style={{ ...inputStyle, width: 100, minWidth: 0, fontFamily: 'monospace', fontSize: 13 }}
            placeholder="#0a1f44"
            maxLength={7}
          />
          <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', flexShrink: 1 }}>يظهر في شريط العنوان على Android والـ PWA</span>
        </div>
      </div>

      {/* ── أزرار ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: '11px 28px', borderRadius: 10,
            background: saved ? '#16a34a' : 'var(--btn-primary-bg, #1a3a6c)',
            color: '#fff', fontWeight: 700, fontSize: 14,
            border: 'none', cursor: 'pointer',
            transition: 'background 0.2s', minWidth: 140,
          }}
        >
          {saved ? '✓ تم الحفظ' : 'حفظ وتطبيق'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          style={{
            padding: '11px 20px', borderRadius: 10,
            background: 'var(--noorix-bg-muted)',
            color: 'var(--noorix-text-muted)',
            fontWeight: 600, fontSize: 13,
            border: '1px solid var(--noorix-border)', cursor: 'pointer',
          }}
        >
          إعادة الضبط الافتراضي
        </button>
      </div>

      {/* ── ملاحظة PWA ────────────────────────────────────────────────────── */}
      <div style={{ padding: 14, borderRadius: 12, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--noorix-accent-blue)' }}>ℹ ملاحظة PWA:</strong>
        <br />
        التغييرات تُطبَّق فوراً على تبويب المتصفح والأيقونة. إذا كان التطبيق مثبّتاً على الجوال، قد تحتاج لإضافته مجدداً للحصول على الأيقونة المحدّثة.
      </div>
    </div>
  );
}
