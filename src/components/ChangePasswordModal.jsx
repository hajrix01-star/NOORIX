/**
 * ChangePasswordModal — نافذة تغيير كلمة المرور
 */
import React, { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { changePassword } from '../services/api';
import { Button, Input, AdaptiveSheet } from '../ui';

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
const STRENGTH_COLORS = ['var(--noorix-accent-red)', '#f97316', '#eab308', 'var(--noorix-accent-green)', 'var(--noorix-accent-green)'];

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

  return (
    <AdaptiveSheet open={true} onClose={onClose} title={t('changePassword')} size="sm" side="start" className="change-password-drawer">
      <form onSubmit={handleSubmit}>
        <div className="flex flex flex-col gap-4">
          <Input
            type="password"
            label={t('changePasswordCurrent') || 'كلمة المرور الحالية'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <div>
            <Input
              type="password"
              label={t('changePasswordNew') || 'كلمة المرور الجديدة'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {newPassword && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
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
                <span className="text-[11px]" style={{ color: strengthColor }}>{strengthLabel}</span>
              </div>
            )}
          </div>
          <div>
            <Input
              type="password"
              label={t('changePasswordConfirm') || 'تأكيد كلمة المرور'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <span className="text-[11px] mt-1" style={{ color: 'var(--noorix-accent-red)', display: 'block' }}>
                كلمتا المرور غير متطابقتين
              </span>
            )}
          </div>
          {error && (
            <div className="p-2.5 rounded-lg text-[13px]" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--noorix-accent-red)' }}>
              {error}
            </div>
          )}
          <div className="flex flex items-center justify-end gap-2.5">
            <Button type="button" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              {loading ? t('loading') : t('save')}
            </Button>
          </div>
        </div>
      </form>
    </AdaptiveSheet>
  );
}
