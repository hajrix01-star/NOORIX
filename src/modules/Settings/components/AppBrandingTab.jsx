/**
 * AppBrandingTab — إعدادات هوية التطبيق (الاسم والشعار واللون)
 * تُخزَّن في localStorage وتُطبَّق فوراً دون إعادة تحميل.
 */
import React, { useState, useRef } from 'react';
import { getBrandName, getBrandLogo, getBrandColor, saveBranding } from '../../../utils/appBranding';
import { fileToDataUrl } from '../constants/settingsConstants';

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
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--noorix-text-muted)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
};

export default function AppBrandingTab() {
  const [name,    setName]    = useState(getBrandName);
  const [logoUrl, setLogoUrl] = useState(getBrandLogo);
  const [color,   setColor]   = useState(getBrandColor);
  const [saved,   setSaved]   = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const url = await fileToDataUrl(file);
      setLogoUrl(url);
    } catch (_) {}
  };

  const handleSave = () => {
    saveBranding({ name: name.trim() || undefined, logoUrl: logoUrl.trim() || undefined, color });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    saveBranding({ name: '', logoUrl: '', color: '' });
    setName('نووريكس');
    setLogoUrl('');
    setColor('#0a1f44');
  };

  return (
    <div style={{ display: 'grid', gap: 28, maxWidth: 560 }}>

      {/* معاينة مباشرة */}
      <div style={{ padding: 20, borderRadius: 16, background: 'var(--noorix-bg-muted)', border: '1px solid var(--noorix-border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--noorix-text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          معاينة مباشرة
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* محاكاة أيقونة التطبيق */}
          <div style={{
            width: 64, height: 64,
            borderRadius: 16,
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}>
            {logoUrl ? (
              <img src={logoUrl} alt="app icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 28, color: '#fff' }}>✦</span>
            )}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--noorix-text)' }}>{name || 'اسم التطبيق'}</div>
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 4 }}>
              هكذا يظهر اسم التطبيق في تبويب المتصفح وعند التثبيت
            </div>
          </div>
        </div>
      </div>

      {/* اسم التطبيق */}
      <div>
        <label style={labelStyle}>اسم التطبيق</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نووريكس"
          style={inputStyle}
          maxLength={40}
        />
        <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 6 }}>
          يظهر في تبويب المتصفح وعنوان نافذة PWA عند التثبيت
        </div>
      </div>

      {/* شعار التطبيق */}
      <div>
        <label style={labelStyle}>شعار التطبيق (الأيقونة)</label>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* معاينة الأيقونة */}
          <div style={{
            width: 72, height: 72, borderRadius: 16, flexShrink: 0,
            border: '2px dashed var(--noorix-border)',
            background: 'var(--noorix-bg-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 28 }}>🖼</span>
            )}
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
              📁 رفع صورة من الجهاز
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
          يُستخدم كأيقونة للمتصفح وعند تثبيت التطبيق على الجوال. مقاس مقترح: 512×512 بكسل.
        </div>
      </div>

      {/* لون السمة */}
      <div>
        <label style={labelStyle}>لون هوية التطبيق</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 52, height: 44, padding: 4, borderRadius: 10, border: '1px solid var(--noorix-border)', cursor: 'pointer', background: 'var(--noorix-bg-surface)' }}
          />
          <input
            type="text"
            value={color}
            onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setColor(e.target.value)}
            style={{ ...inputStyle, maxWidth: 120, fontFamily: 'monospace', fontSize: 13 }}
            placeholder="#0a1f44"
            maxLength={7}
          />
          <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>يظهر في شريط العنوان على Android والـ PWA</span>
        </div>
      </div>

      {/* أزرار الحفظ */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: '11px 28px', borderRadius: 10,
            background: saved ? '#16a34a' : 'var(--btn-primary-bg, #1a3a6c)',
            color: '#fff', fontWeight: 700, fontSize: 14,
            border: 'none', cursor: 'pointer',
            transition: 'background 0.2s',
            minWidth: 140,
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

      {/* ملاحظة PWA */}
      <div style={{ padding: 14, borderRadius: 12, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--noorix-accent-blue)' }}>ℹ ملاحظة PWA:</strong>
        <br />
        التغييرات تُطبَّق فوراً على تبويب المتصفح والأيقونة. إذا كان التطبيق مثبّتاً على الجوال، قد تحتاج لإضافته مجدداً من المتصفح للحصول على الأيقونة المحدّثة.
      </div>
    </div>
  );
}
