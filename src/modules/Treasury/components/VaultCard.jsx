import React, { memo, useState, useRef, useEffect } from 'react';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { useTranslation } from '../../../i18n/useTranslation';
import { VAULT_TYPES, PAYMENT_METHODS, TYPE_COLORS } from '../constants/treasuryConstants';

/* ── أيقونات SVG احترافية بدل الإيموجي ─────────────────────── */
const ICONS = {
  cash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="2.5"/>
      <path d="M6 12h.01M18 12h.01"/>
    </svg>
  ),
  bank: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <path d="M3 9l9-7 9 7"/>
      <rect x="4" y="9" width="3" height="9"/>
      <rect x="10.5" y="9" width="3" height="9"/>
      <rect x="17" y="9" width="3" height="9"/>
      <line x1="2" y1="18" x2="22" y2="18"/>
    </svg>
  ),
  app: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
};

/* ── قائمة سياق خفية — fixed positioning لتجنب القطع من overflow: hidden ─── */
function ActionMenu({ vault, onEdit, onToggleSalesChannel, onArchive, onDelete, t, lang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, right: 0 });
  const isArchived = vault.isArchived;
  const isRtl = lang !== 'en';

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('touchstart', handler, true);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('touchstart', handler, true);
    };
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left, right: window.innerWidth - rect.right });
    }
    setOpen((p) => !p);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          width: 32, height: 32, borderRadius: 8, border: '1px solid var(--noorix-border)',
          background: 'var(--noorix-bg-muted)', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'var(--noorix-text-muted)',
          transition: 'background 120ms',
        }}
        title={t('actions')}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'fixed', top: pos.top, zIndex: 9999,
          ...(isRtl ? { right: pos.right } : { left: pos.left }),
          background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: lang === 'en' ? 190 : 160, width: 'max-content', maxWidth: 240,
          padding: '4px 0', direction: isRtl ? 'rtl' : 'ltr',
        }}>
          {[
            { label: t('edit'),    action: () => { onEdit(vault); setOpen(false); }, color: 'var(--noorix-text)' },
            { label: vault.isSalesChannel ? t('salesChannelEnabled') : t('salesChannel'),
              action: () => { onToggleSalesChannel(vault); setOpen(false); }, color: '#16a34a' },
            { label: isArchived ? t('restore') : t('archive'),
              action: () => { onArchive(vault); setOpen(false); }, color: '#d97706' },
            { label: t('delete'), action: () => { onDelete(vault); setOpen(false); }, color: '#dc2626' },
          ].map(({ label, action, color }) => (
            <button
              key={label} type="button" onClick={action}
              style={{
                display: 'block', width: '100%', textAlign: isRtl ? 'right' : 'left', padding: '9px 16px',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                color, fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--noorix-bg-muted)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ الكرت الرئيسي ══════════════════════════════════════════════ */
const VaultCard = memo(function VaultCard({
  vault, onEdit, onToggleSalesChannel, onArchive, onDelete, onClick,
}) {
  const { t, lang } = useTranslation();

  const typeInfo  = VAULT_TYPES.find((x) => x.value === vault.type) || VAULT_TYPES[0];
  const accentColor = TYPE_COLORS[vault.type] || '#2563eb';
  const isArchived  = vault.isArchived;
  const balance     = Number(vault.balance ?? 0);
  const totalIn     = Number(vault.totalIn ?? 0);
  const totalOut    = Number(vault.totalOut ?? 0);

  const typeLabels  = { cash: t('vaultTypeCash'), bank: t('vaultTypeBank'), app: t('vaultTypeApp') };
  const typeLabel   = typeLabels[vault.type] || vault.type;
  const displayName = vaultDisplayName(vault, lang);
  const subName     = lang === 'en' ? (vault.nameAr || typeLabel) : (vault.nameEn || typeLabel);

  return (
    <div
      onClick={() => onClick(vault)}
      style={{
        borderRadius: 14,
        border: '1px solid var(--noorix-border)',
        background: 'var(--noorix-bg-surface)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', cursor: 'pointer',
        opacity: isArchived ? 0.65 : 1,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'box-shadow 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.13)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
    >
      {/* شريط لوني علوي رفيع */}
      <div style={{ height: 3, background: isArchived ? 'var(--noorix-border)' : accentColor }} />

      {/* هيدر الكرت */}
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        {/* أيقونة + الاسم */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: isArchived ? 'var(--noorix-bg-muted)' : accentColor + '14',
            color: isArchived ? 'var(--noorix-text-muted)' : accentColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {ICONS[vault.type] || ICONS.bank}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 1 }}>
              {subName}
            </div>
          </div>
        </div>

        {/* قائمة الإجراءات */}
        <ActionMenu vault={vault} t={t} lang={lang} onEdit={onEdit} onToggleSalesChannel={onToggleSalesChannel} onArchive={onArchive} onDelete={onDelete} />
      </div>

      {/* الرصيد — العنصر الأبرز */}
      <div style={{ padding: '2px 16px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {t('balance')}
        </div>
        <div style={{
          fontSize: 26, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)',
          color: balance < 0 ? '#dc2626' : 'var(--noorix-text)',
          letterSpacing: '-0.5px',
        }}>
          {balance < 0 ? '−' : ''}{fmt(Math.abs(balance), 2)}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--noorix-text-muted)', marginRight: 4 }}>﷼</span>
        </div>
      </div>

      {/* فاصل */}
      <div style={{ margin: '0 16px', height: 1, background: 'var(--noorix-border)' }} />

      {/* وارد / صادر */}
      <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg viewBox="0 0 12 12" fill="none" stroke="#16a34a" strokeWidth="2" width="10" height="10">
              <path d="M6 10V2M2 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('inbound')}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', color: '#16a34a' }}>
            {fmt(totalIn, 2)} <span style={{ fontWeight: 400, color: 'var(--noorix-text-muted)', fontSize: 11 }}>﷼</span>
          </div>
        </div>
        <div style={{ textAlign: 'left', borderRight: '1px solid var(--noorix-border)', paddingRight: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            {t('outbound')}
            <svg viewBox="0 0 12 12" fill="none" stroke="#dc2626" strokeWidth="2" width="10" height="10">
              <path d="M6 2v8M2 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', color: 'var(--noorix-text)', textAlign: 'right' }}>
            {fmt(totalOut, 2)} <span style={{ fontWeight: 400, color: 'var(--noorix-text-muted)', fontSize: 11 }}>﷼</span>
          </div>
        </div>
      </div>

      {/* فوتر: شارات الحالة */}
      {(vault.isSalesChannel || vault.account?.code || isArchived) && (
        <div style={{
          padding: '8px 16px', borderTop: '1px solid var(--noorix-border)',
          display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {vault.isSalesChannel && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 700,
              background: '#16a34a14', color: '#16a34a', border: '1px solid #16a34a25',
            }}>
              {t('salesChannel')}
            </span>
          )}
          {vault.isSalesChannel && vault.paymentMethod && (() => {
            const pm = PAYMENT_METHODS.find((m) => m.value === vault.paymentMethod);
            const pmLabel = pm?.labelKey ? t(pm.labelKey) : (pm?.label ?? vault.paymentMethod);
            return (
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600,
                background: 'var(--noorix-bg-muted)', color: 'var(--noorix-text-muted)',
                border: '1px solid var(--noorix-border)',
              }}>
                {pmLabel}
              </span>
            );
          })()}
          {vault.account?.code && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600,
              background: 'var(--noorix-bg-muted)', color: 'var(--noorix-text-muted)',
              border: '1px solid var(--noorix-border)', marginRight: 'auto',
            }}>
              {vault.account.code}
            </span>
          )}
          {isArchived && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 700,
              background: '#d9780614', color: '#d97806', border: '1px solid #d9780625',
            }}>
              {t('archived')}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default VaultCard;
