import React from 'react';
import type { CSSProperties, DragEvent, ChangeEvent } from 'react';
import { Button } from '../../../ui';
import type { ImportEntityType } from '../types';
import type { ImportExportStyles } from '../types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function ImportUploadSection({
  phase,
  dragging,
  setDragging,
  onDrop,
  onPickFile,
  fileInputRef,
  parsedRowsCount,
  onChooseOtherFile,
  S,
  t,
}: {
  phase: string;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onPickFile: (file: File | undefined) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  parsedRowsCount: number;
  onChooseOtherFile: () => void;
  S: ImportExportStyles;
  t: TFn;
}) {
  return (
    <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-3">
      <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2">{t('importStep2Title')}</p>
      <div
        style={S.dropzone(dragging) as CSSProperties}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="mb-2 text-[36px]" />
        <div className="text-[14px] font-semibold mb-1">
          {phase === 'parsing' ? t('importDropzoneParsing') : t('importDropzoneIdle')}
        </div>
        <div className="text-[12px] text-noorix-muted">xlsx / xls / csv</div>
      </div>
      <input
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => onPickFile(e.target.files?.[0])}
      />
      {parsedRowsCount > 0 && (
        <div className="text-[13px] text-noorix-muted">
          {t('importRowsRead', { count: parsedRowsCount })}
          {phase !== 'done' && (
            <Button variant="ghost" size="sm" className="me-3" onClick={onChooseOtherFile}>
              {t('importChooseOtherFile')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
