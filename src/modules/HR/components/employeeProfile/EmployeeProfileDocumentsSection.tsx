import { Button, SmartTable } from '../../../../ui';

export function EmployeeProfileDocumentsSection({
  t,
  documents,
  uploading,
  fileInputRef,
  onFileChange,
  onPickFile,
  onDownload,
}: any) {
  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('employeeDocuments')}</span>
        <div className="nx-section-header__actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            className="hidden"
            onChange={onFileChange}
          />
          <Button size="sm" disabled={uploading} loading={uploading} onClick={onPickFile}>
            {uploading ? t('saving') : t('uploadFile')}
          </Button>
        </div>
      </div>
      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={[
          {
            key: 'fileName',
            label: t('documentType') || 'المستند',
            width: '75%',
            render: (v: any, row: any) => (
              <span className="nx-cell-ellipsis" title={row.fileName || row.documentType || ''}>
                {row.fileName || row.documentType || 'مستند'}
              </span>
            ),
          },
          {
            key: 'actions',
            label: t('actions'),
            width: '24%',
            align: 'center',
            render: (_: any, row: any) => (
              <Button size="sm" onClick={() => onDownload(row.id)}>
                {t('download')}
              </Button>
            ),
          },
        ]}
        data={documents}
        total={documents.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: any) => (
          <div>
            <div className="nx-cr__line1">
              <span className="nx-cr__name">{row.fileName || row.documentType || 'مستند'}</span>
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start" />
              <div className="nx-cr__line2-end">
                <div onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" onClick={() => onDownload(row.id)}>{t('download')}</Button>
                </div>
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: any) => (
          <div className="flex flex-col gap-2">
            <div>
              <div className="nx-mc__stat-label">{t('documentType')}</div>
              <div className="text-[13px] font-medium text-noorix-text break-words">
                {row.fileName || row.documentType || 'مستند'}
              </div>
            </div>
            <div className="nx-mc__actions">
              <Button
                size="sm"
                className="min-h-[44px] sm:min-h-0"
                onClick={() => onDownload(row.id)}
              >
                {t('download')}
              </Button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
