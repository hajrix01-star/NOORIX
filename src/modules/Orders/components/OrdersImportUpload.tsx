import React from 'react';
import { Button, FileInput } from '../../../ui';

type TranslateFn = (key: string, vars?: unknown) => string;

export function OrdersImportUpload({
  t,
  importSectionsNode,
  parseError,
  onFile,
}: {
  t: TranslateFn;
  importSectionsNode: React.ReactNode;
  parseError: string;
  onFile: (file: File) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = '';
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className="flex flex-col gap-4">
      {importSectionsNode}
      {parseError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 text-[12px]">
          <span className="text-base leading-none mt-0.5">!</span>
          <span>{parseError}</span>
        </div>
      )}
      <div
        className={`
          border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer
          transition-all duration-150 select-none
          ${isDragging
            ? 'border-noorix-primary bg-noorix-primary/5 scale-[1.01]'
            : 'border-noorix-border hover:border-noorix-primary/60 hover:bg-noorix-bg-muted/60'
          }
        `}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => event.key === 'Enter' && fileRef.current?.click()}
      >
        <div className="text-center">
          <p className="text-[15px] font-semibold text-noorix-text m-0 mb-1">{t('importDropZoneTitle')}</p>
          <p className="text-[12px] text-noorix-muted m-0">{t('importDropZoneOr')}</p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={(event: React.MouseEvent) => { event.stopPropagation(); fileRef.current?.click(); }}
        >
          {t('importChooseFile')}
        </Button>
        <p className="text-[11px] text-noorix-muted m-0">{t('importDropZoneHint')}</p>
      </div>
      <FileInput ref={fileRef} accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
      <p className="text-[11px] text-noorix-muted m-0 text-center">{t('importDropZoneNote')}</p>
    </div>
  );
}
