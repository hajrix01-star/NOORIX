import { Button, ScreenShell } from '../../../../ui';

export function EmployeeProfileLoading({ t }: any) {
  return (
    <ScreenShell>
      <div className="mx-auto w-full max-w-[1160px] space-y-4 py-6">
        <div className="h-11 rounded-lg bg-noorix-bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-40 rounded-xl bg-noorix-bg-muted animate-pulse" />
          <div className="h-40 rounded-xl bg-noorix-bg-muted animate-pulse" />
        </div>
        {[1, 2, 3].map((k: any) => (
          <div key={k} className="h-36 rounded-xl bg-noorix-bg-muted animate-pulse" />
        ))}
        <p className="m-0 text-center text-[13px] font-medium text-noorix-muted">{t('loading')}</p>
      </div>
    </ScreenShell>
  );
}

export function EmployeeProfileNotFound({ t, onBack }: any) {
  return (
    <ScreenShell>
      <div className="noorix-surface-card p-8 flex flex-col items-center gap-4 text-center">
        <p className="text-noorix-muted text-[14px] m-0">{t('noEmployees')}</p>
        <Button size="sm" onClick={onBack}>
          {t('employeeProfileBack')}
        </Button>
      </div>
    </ScreenShell>
  );
}

export function EmployeeProfileCentralDataError({ t, onBack, message }: any) {
  return (
    <ScreenShell>
      <div className="noorix-surface-card p-8 flex flex-col items-center gap-4 text-center">
        <p className="text-noorix-red text-[14px] font-semibold m-0">
          {message || t('loadFailed') || 'فشل تحميل بيانات HR المركزية'}
        </p>
        <p className="text-noorix-muted text-[13px] m-0">
          لا يتم عرض أرقام الراتب من حساب بديل حفاظًا على مصدر واحد للأرقام.
        </p>
        <Button size="sm" onClick={onBack}>
          {t('employeeProfileBack')}
        </Button>
      </div>
    </ScreenShell>
  );
}
