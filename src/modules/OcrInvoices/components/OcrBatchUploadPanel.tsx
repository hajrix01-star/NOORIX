import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button } from '../../../ui';
import { compressImageFileToJpegDataUrl } from '../../../utils/imageUtils';
import { submitOcrBatchSubmission } from '../services/ocrApi';

type PendingImage = {
  uid: string;
  preview: string;
  base64: string;
  mimeType: string;
  name: string;
};

type InvoiceGroup = {
  uid: string;
  layout: 'single' | 'multi_page';
  images: PendingImage[];
};

function newUid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type OcrBatchUploadPanelProps = {
  disabled?: boolean;
  compact?: boolean;
  companyId?: string;
};

export function OcrBatchUploadPanel({ disabled = false, compact = false, companyId = '' }: OcrBatchUploadPanelProps) {
  const { t, lang } = useTranslation();
  const isAr = lang === 'ar';
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [groups, setGroups] = useState<InvoiceGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const totalImages = useMemo(
    () => groups.reduce((sum, g) => sum + g.images.length, 0),
    [groups],
  );

  const addFiles = useCallback(async (files: FileList | File[] | null | undefined) => {
    if (!files?.length) return;
    setError(null);
    setSentCount(null);
    const nextGroups: InvoiceGroup[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressed = await compressImageFileToJpegDataUrl(file, { maxDim: 1600, quality: 0.82 });
        const preview = String(compressed);
        const img: PendingImage = {
          uid: newUid(),
          preview,
          base64: preview.split(',')[1] || '',
          mimeType: 'image/jpeg',
          name: file.name || 'image',
        };
        nextGroups.push({ uid: newUid(), layout: 'single', images: [img] });
      } catch (err: unknown) {
        setError((err as Error)?.message || t('ocrBatchReadFailed'));
      }
    }
    if (nextGroups.length) {
      setGroups((prev) => [...prev, ...nextGroups]);
    }
  }, [t]);

  const toggleSelect = useCallback((imageUid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(imageUid)) next.delete(imageUid);
      else next.add(imageUid);
      return next;
    });
  }, []);

  const removeGroup = useCallback((groupUid: string) => {
    setGroups((prev) => prev.filter((g) => g.uid !== groupUid));
    setSelected(new Set());
  }, []);

  const groupSelectedAsMultiPage = useCallback(() => {
    if (selected.size < 2) return;
    setGroups((prev) => {
      const picked: PendingImage[] = [];
      const rest: InvoiceGroup[] = [];
      for (const group of prev) {
        const keep = group.images.filter((img) => !selected.has(img.uid));
        const take = group.images.filter((img) => selected.has(img.uid));
        if (take.length) picked.push(...take);
        if (keep.length) {
          rest.push({
            ...group,
            images: keep,
            layout: keep.length > 1 ? group.layout : 'single',
          });
        }
      }
      if (picked.length < 2) return prev;
      rest.unshift({ uid: newUid(), layout: 'multi_page', images: picked });
      return rest;
    });
    setSelected(new Set());
  }, [selected]);

  const splitMultiPageGroup = useCallback((groupUid: string) => {
    setGroups((prev) => {
      const target = prev.find((g) => g.uid === groupUid);
      if (!target || target.layout !== 'multi_page' || target.images.length < 2) return prev;
      const splitGroups = target.images.map((img) => ({
        uid: newUid(),
        layout: 'single' as const,
        images: [img],
      }));
      return [...splitGroups, ...prev.filter((g) => g.uid !== groupUid)];
    });
    setSelected(new Set());
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!groups.length || loading) return;
    const cid = String(companyId || '').trim();
    if (!cid) {
      setError(t('ocrBatchNeedCompany'));
      return;
    }
    setLoading(true);
    setError(null);
    setSentCount(null);
    try {
      const entries = groups.map((group) => ({
        layout: group.layout,
        images: group.images.map((img) => ({
          imageBase64: img.base64,
          mimeType: img.mimeType,
        })),
      }));
      const res = await submitOcrBatchSubmission(entries, cid);
      if (res.success && res.data?.count != null) {
        setSentCount(Number(res.data.count));
        setGroups([]);
        setSelected(new Set());
      } else {
        setError(res.error || t('ocrBatchSubmitFailed'));
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || t('ocrBatchSubmitFailed'));
    } finally {
      setLoading(false);
    }
  }, [groups, loading, t, companyId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  }, [addFiles]);

  return (
    <div className={`flex flex-col gap-3${compact ? '' : ' max-w-2xl mx-auto w-full'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {!compact && (
        <p className="text-[13px] text-noorix-muted m-0">{t('ocrBatchAutoHint')}</p>
      )}

      {sentCount != null && sentCount > 0 && (
        <div className="rounded-lg border border-noorix-accent-green/40 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-[13px] text-noorix-text">
          {t('ocrBatchSentOk', String(sentCount))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-noorix-red/40 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-[13px] text-noorix-red whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div
        className={`ocr-upload-zone border-2 border-dashed rounded-xl p-6 text-center cursor-pointer bg-noorix-bg-muted/50 hover:border-noorix-blue disabled:opacity-50${dragging ? ' border-noorix-blue' : ' border-noorix-border'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => { if (!disabled) fileRef.current?.click(); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
      >
        <div className="text-noorix-muted text-[13px]">{t('ocrBatchDragDrop')}</div>
        <div className="text-[11px] text-noorix-muted mt-1">{t('ocrSupportedFormats')}</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {groups.length > 0 && (
        <div className="noorix-surface-card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-noorix-text">
              {t('ocrBatchPendingCount', String(totalImages))}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={selected.size < 2}
                onClick={groupSelectedAsMultiPage}
              >
                {t('ocrBatchGroupMultiPage')}
              </Button>
              <Button size="sm" variant="secondary" type="button" onClick={() => { setGroups([]); setSelected(new Set()); }}>
                {t('ocrCancel')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                type="button"
                disabled={loading || disabled}
                onClick={() => { void handleSubmit(); }}
              >
                {loading ? t('ocrSubmitting') : t('ocrBatchSubmitAll')}
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-noorix-muted m-0">{t('ocrBatchGroupHint')}</p>

          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.uid} className="rounded-lg border border-noorix-border p-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-noorix-text">
                    {group.layout === 'multi_page'
                      ? t('ocrBatchLayoutMultiPage', String(group.images.length))
                      : t('ocrBatchLayoutSingle')}
                  </span>
                  <div className="flex gap-2">
                    {group.layout === 'multi_page' && group.images.length > 1 && (
                      <Button size="sm" variant="ghost" type="button" onClick={() => splitMultiPageGroup(group.uid)}>
                        {t('ocrBatchSplitGroup')}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" type="button" onClick={() => removeGroup(group.uid)}>
                      {t('ocrBatchRemoveGroup')}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.images.map((img) => (
                    <label
                      key={img.uid}
                      className={`relative block w-[88px] h-[88px] rounded-lg overflow-hidden border cursor-pointer${selected.has(img.uid) ? ' border-noorix-blue ring-2 ring-noorix-blue/30' : ' border-noorix-border'}`}
                      title={img.name}
                    >
                      <input
                        type="checkbox"
                        className="absolute top-1 start-1 z-10"
                        checked={selected.has(img.uid)}
                        onChange={() => toggleSelect(img.uid)}
                      />
                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default OcrBatchUploadPanel;
