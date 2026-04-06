/**
 * ChangePasswordModal — نافذة تغيير كلمة المرور
 */
import React, { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { changePassword } from '../services/api';

const MIN_LENGTH = 8;

/**
 * يُحسب مستوى قوة كلمة المرور من 0 إلى 4.
 * المعايير: الطول، أرقام، حروف صغيرة، حروف كبيرة، رموز خاصة.
 */
function getPasswordStrength(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= MIN_LENGTH) score++;
  if (pwd.length >= 12) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية'];
const STRENGTH_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

export default function ChangePasswordModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(newPassword);
  const strengthLabel = newPassword ? STRENGTH_LABELS[strength] : '';
  const strengthColor = newPassword ? STRENGTH_COLORS[strength] : 'var(--noorix-border)';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!currentPassword.trim()) {
      setError(t('changePasswordCurrentRequired') || 'كلمة المرور الحالية مطلوبة');
      return;
    }
    if (!newPassword.trim()) {
      setError(t('changePasswordNewRequired') || 'كلمة المرور الجديدة مطلوبة');
      return;
    }
    if (newPassword.length < MIN_LENGTH) {
      setError(t('changePasswordMinLength') || `كلمة المرور الجديدة يجب أن تكون ${MIN_LENGTH} أحرف على الأقل`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('changePasswordMismatch') || 'كلمة المرور الجديدة غير متطابقة');
      return;
    }
    setLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res?.success) {
        onSuccess?.(t('changePasswordSuccess') || 'تم تغيير كلمة المرور بنجاح');
        onClose?.();
      } else {
        setError(res?.error || t('changePasswordFailed') || 'فشل تغيير كلمة المرور');
      }
    } catch (err) {
      setError(err?.message || t('changePasswordFailed') || 'فشل تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--noorix-border)',
    background: 'var(--noorix-bg-surface)',
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'var(--noorix-modal-overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="noorix-modal-card"
        style={{
          borderRadius: 14,
          maxWidth: 400,
          width: '100%',
          padding: 24,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>{t('changePassword')}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {t('changePasswordCurrent') || 'كلمة المرور الحالية'}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {t('changePasswordNew') || 'كلمة المرور الجديدة'}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="new-password"
            />
            {/* مؤشر قوة كلمة المرور */}
            {newPassword && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 4,
                        background: strength >= level ? strengthColor : 'var(--noorix-border)',
                        transition: 'background 0.2s',
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: strengthColor }}>{strengthLabel}</span>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {t('changePasswordConfirm') || 'تأكيد كلمة المرور'}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="new-password"
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <span style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'block' }}>
                كلمتا المرور غير متطابقتين
              </span>
            )}
          </div>
          {error && (
            <div style={{ marginBottom: 16, padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="noorix-btn-nav" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="noorix-btn-nav noorix-btn-primary" disabled={loading}>
              {loading ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
