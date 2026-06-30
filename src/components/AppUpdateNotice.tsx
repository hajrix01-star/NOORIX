import React from 'react';
import { Button } from '../ui';
import type { DeployVersionInfo } from '../utils/deployVersionGuard';
import { formatAppVersion } from '../constants/appVersion';

type Props = {
  update: DeployVersionInfo | null;
  onRefresh: () => void;
};

export function AppUpdateNotice({ update, onRefresh }: Props) {
  if (!update) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-x-3 bottom-3 z-[10000] mx-auto max-w-[560px] rounded-xl border border-noorix-blue/30 bg-noorix-surface shadow-[0_12px_40px_rgba(10,31,68,0.22)]"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[14px] font-extrabold text-noorix-text">
            يوجد تحديث جديد للنظام
          </div>
          <div className="mt-1 text-[12px] leading-5 text-noorix-muted">
            حدث الصفحة الآن حتى تعمل على آخر نسخة وتتجنب أخطاء النسخ القديمة.
            {update.version ? (
              <span className="ms-1 font-bold text-noorix-blue">{formatAppVersion(update.version)}</span>
            ) : null}
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={onRefresh} className="shrink-0">
          تحديث الآن
        </Button>
      </div>
    </div>
  );
}
