import { Button } from '../../../../ui';

export function EmployeeProfileHeaderBar({
  t,
  onBack,
  onSalaryCert,
  onContract,
  onSettlement,
  onPayAdvance,
  onPermanentDelete,
  canDelete,
  canPayAdvance,
}) {
  return (
    <div className="nx-page-header employee-profile-header-bar">
      <Button size="sm" onClick={onBack}>
        {t('employeeProfileBack')}
      </Button>
      <div className="nx-toolbar">
        <Button size="sm" onClick={onSalaryCert}>
          {t('salaryCertificate') || 'تعريف راتب'}
        </Button>
        <Button size="sm" onClick={onContract}>
          {t('documentContract') || 'عقد'}
        </Button>
        <Button size="sm" onClick={onSettlement}>
          {t('finalSettlement') || 'مخالصة'}
        </Button>
        {canPayAdvance && (
          <Button variant="primary" size="sm" onClick={onPayAdvance}>
            {t('payAdvance')}
          </Button>
        )}
        {canDelete && (
          <Button variant="danger" size="sm" onClick={onPermanentDelete}>
            {t('deleteEmployeePermanent')}
          </Button>
        )}
      </div>
    </div>
  );
}
