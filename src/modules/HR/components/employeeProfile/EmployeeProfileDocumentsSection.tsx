import { Button, FileInput, SmartTable } from '../../../../ui';

type TranslationFn = (key: string, ...args: unknown[]) => string;
type ProfileDocumentRow = {
  id?: string | null;
  fileName?: string | null;
  documentType?: string | null;
};
type EmployeeProfileDocumentsSectionProps = {
  t: TranslationFn;
  documents: ProfileDocumentRow[];
  uploading: boolean;
  fileInputRef: React.Ref<HTMLInputElement>;
  onFileChange: React.ChangeEventHandler<HTMLInputElement>;
  onPickFile: () => void;
  onDownload: (id: string) => void;
};

export function EmployeeProfileDocumentsSection({
  t,
  documents,
  uploading,
  fileInputRef,
  onFileChange,
  onPickFile,
  onDownload,
}: EmployeeProfileDocumentsSectionProps) {
  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('employeeDocuments')}</span>
        <div className="nx-section-header__actions">
          <FileInput
            ref={fileInputRef}
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
        innerPadding={8}
        columns={[
          {
            key: 'fileName',
            label: t('documentType') || 'المستند',
            size: 'name',
            render: (_v: unknown, row: ProfileDocumentRow) => (
              <Button
                variant="raw"
                size="auto"
                disabled={!row.id}
                className="nx-cell-ellipsis text-noorix-blue hover:underline disabled:text-noorix-muted disabled:no-underline"
                title={row.fileName || row.documentType || ''}
                onClick={() => row.id && onDownload(row.id)}
              >
                {row.fileName || row.documentType || 'مستند'}
              </Button>
            ),
          },
        ]}
        data={documents}
        total={documents.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: ProfileDocumentRow) => (
          <div>
            <div className="nx-cr__line1">
              <span className="nx-cr__name">{row.fileName || row.documentType || 'مستند'}</span>
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start" />
              <div className="nx-cr__line2-end">
                <div onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" disabled={!row.id} onClick={() => row.id && onDownload(row.id)}>{t('download')}</Button>
                </div>
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: ProfileDocumentRow) => (
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
                disabled={!row.id}
                onClick={() => row.id && onDownload(row.id)}
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
