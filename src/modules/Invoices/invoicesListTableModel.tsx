import React from 'react';
import { formatSaudiDateISO } from '../../utils/saudiDate';
import { Badge, FmtNum, KebabMenu, cn } from '../../ui';
import InvoiceActionsCell from '../../components/common/InvoiceActionsCell';
import { PAGE_SIZE } from './invoicesListScreenHelpers';

/**
 * تعريف أعمدة SmartTable + تذييل المجاميع + بطاقة الجوال — مستخرج من InvoicesListScreen
 */

export function buildInvoiceListColumns({
  t,
  lang,
  fmt,
  STATUS_MAP,
  KIND_MAP,
  userRole,
  companyId,
  setViewingInvoice,
  setEditingInvoice,
  confirmAndDeleteInvoice,
}: any) {
  return [
    {
      key: 'invoiceNumber',
      kind: 'id',
      label: t('documentNumber'),
      align: 'center',
      shrink: true,
      width: '12%',
      sortable: true,
      render: (v: any, row: any) => {
        const isInbound = row.kind === 'sale';
        return (
          <span
            className="nx-cell-num nx-cell-ellipsis"
            style={{ color: isInbound ? 'var(--color-nx-sales)' : 'var(--color-nx-expenses)', fontWeight: 700 }}
            title={v || ''}
          >
            {v || '—'}
          </span>
        );
      },
    },
    {
      key: 'supplierInvoiceNumber',
      kind: 'id',
      label: t('supplierInvoiceNumber'),
      align: 'center',
      shrink: true,
      width: '7%',
      render: (v: any) => (
        <span className="nx-cell-num nx-cell-muted nx-cell-ellipsis" title={v || ''}>
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'supplierName',
      kind: 'text',
      label: t('supplier'),
      align: 'center',
      width: '7%',
      render: (v: any) => (
        <span className="nx-cell-ellipsis" title={v || ''}>
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'createdByDisplayName',
      kind: 'text',
      label: t('invoiceUserColumn'),
      align: 'center',
      width: '8%',
      render: (v: any) => (
        <span className="nx-cell-ellipsis" title={v || ''}>
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'notesOrEmployee',
      kind: 'text',
      label: t('invoiceNotesColumn') || 'ملاحظة',
      align: 'center',
      width: '8%',
      render: (_: any, row: any) => (
        <span className="nx-cell-ellipsis" title={row.notes || ''}>
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'kind',
      kind: 'status',
      label: t('type'),
      align: 'center',
      shrink: true,
      width: '6%',
      render: (v: any) => <Badge {...Badge.fromStatus(v, KIND_MAP)} size="sm" />,
    },
    {
      key: 'vaultLabel',
      kind: 'text',
      label: t('invoiceVaultColumn'),
      align: 'center',
      width: '20%',
      render: (_: any, row: any) => {
        const a = row.vaultAllocations;
        if (a?.length > 0) {
          return (
            <div className="flex flex-nowrap gap-1.5 justify-center overflow-hidden">
              {a.map((al: any) => {
                const vn = lang === 'en' ? al.vault?.nameEn || al.vault?.nameAr : al.vault?.nameAr || al.vault?.nameEn;
                return (
                  <div
                    key={al.id}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-noorix-border',
                      'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
                    )}
                    title={vn ? `${vn} — ${fmt(al.amount)} SR` : ''}
                  >
                    <span className="truncate text-[11px] font-semibold text-noorix-text max-w-[60px]">{vn || '—'}</span>
                    <span dir="ltr" className="shrink-0 whitespace-nowrap text-[12px] font-bold tabular-nums text-nx-sales">
                      <FmtNum n={al.amount} /> <span className="nx-sar">SR</span>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }
        const vn = row.vault
          ? lang === 'en'
            ? row.vault.nameEn || row.vault.nameAr
            : row.vault.nameAr || row.vault.nameEn
          : '';
        return (
          <span className="nx-cell-ellipsis text-[12px] text-center" title={vn || ''}>
            {vn || '—'}
          </span>
        );
      },
    },
    {
      key: 'netAmount',
      kind: 'money',
      label: t('net'),
      align: 'center',
      numeric: true,
      shrink: true,
      width: '7%',
      sortable: true,
      render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-num--green" />,
    },
    {
      key: 'taxAmount',
      kind: 'money',
      label: t('tax'),
      align: 'center',
      numeric: true,
      shrink: true,
      width: '6%',
      render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-num--amber" />,
    },
    {
      key: 'totalAmount',
      kind: 'money',
      label: t('total'),
      align: 'center',
      numeric: true,
      shrink: true,
      width: '7%',
      sortable: true,
      render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-bold" />,
    },
    {
      key: 'transactionDate',
      kind: 'date',
      label: t('date'),
      align: 'center',
      sortable: true,
      shrink: true,
      width: '7%',
      render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDateISO(v)}</span>,
    },
    {
      key: 'status',
      kind: 'status',
      label: t('statusLabel'),
      align: 'center',
      shrink: true,
      width: '6%',
      render: (v: any) => <Badge {...Badge.fromStatus(v, STATUS_MAP)} size="sm" />,
    },
    {
      key: 'actions',
      kind: 'actions',
      label: t('actions'),
      align: 'center',
      width: '5%',
      shrink: true,
      render: (_: any, row: any) => (
        <InvoiceActionsCell
          row={row}
          userRole={userRole}
          companyId={companyId}
          onView={(r: any) => setViewingInvoice(r)}
          onPrint={() => window.print()}
          onEdit={(r: any) => setEditingInvoice(r)}
          onDelete={confirmAndDeleteInvoice}
        />
      ),
    },
  ];
}

export function buildInvoiceListFooterRow({ t, serverAll, total }: any) {
  return [
    {
      keys: ['invoiceNumber', 'supplierInvoiceNumber', 'supplierName', 'createdByDisplayName', 'notesOrEmployee', 'kind', 'vaultLabel'],
      className: 'nx-tfoot-label text-[12px] text-center',
      content: (
        <>
          {t('totalInvoices', serverAll.count)}
          {total > PAGE_SIZE && (
            <span className="text-[11px]" style={{ opacity: 0.65 }}>
              {' '}
              ({t('allPages')})
            </span>
          )}
        </>
      ),
    },
    {
      keys: ['netAmount'],
      className: 'nx-tfoot-num nx-cell-num--green text-center',
      content: <FmtNum n={Number(serverAll.net)} />,
    },
    {
      keys: ['taxAmount'],
      className: 'nx-tfoot-num nx-cell-num--amber text-center',
      content: <FmtNum n={Number(serverAll.tax)} />,
    },
    {
      keys: ['totalAmount'],
      className: 'nx-tfoot-num nx-cell-num--violet text-center',
      content: <FmtNum n={Number(serverAll.total)} />,
    },
  ];
}

/**
 * renderCompactRow — نمط السطر المضغوط (2 سطور) للجوال.
 * السطر الأول: رقم الفاتورة + نوعها + اسم المورد + الحالة.
 * السطر الثاني: التاريخ + المبلغ الإجمالي + كباب الإجراءات.
 * الضغط على الصف يفتح تفاصيل الفاتورة (setViewingInvoice).
 */
export function createInvoiceCompactRowRenderer({
  t,
  STATUS_MAP,
  KIND_MAP,
  userRole,
  companyId,
  setViewingInvoice,
  setEditingInvoice,
  confirmAndDeleteInvoice,
}: any) {
  return (row: any) => {
    const isInbound = row.kind === 'sale';
    const amountColor = isInbound ? 'var(--color-nx-sales)' : 'var(--color-nx-expenses)';
    return (
      <div onClick={() => setViewingInvoice?.(row)} style={{ cursor: 'pointer' }}>
        {/* السطر الأول */}
        <div className="nx-cr__line1">
          <span className="nx-cr__id" style={{ color: amountColor }}>
            {row.invoiceNumber || '—'}
          </span>
          <Badge {...Badge.fromStatus(row.kind, KIND_MAP)} size="sm" />
          <span className="nx-cr__sub flex-1">{row.supplierName || '—'}</span>
          <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
        </div>
        {/* السطر الثاني */}
        <div className="nx-cr__line2">
          <div className="nx-cr__line2-start">
            <span className="nx-cr__meta">{formatSaudiDateISO(row.transactionDate)}</span>
          </div>
          <div className="nx-cr__line2-end">
            <span className="nx-cr__amount" style={{ color: amountColor }}>
              <FmtNum n={row.totalAmount} /> <span className="nx-sar">SR</span>
            </span>
            <div
              className="nx-cr__kebab"
              onClick={(e) => e.stopPropagation()}
            >
              <KebabMenu
                ariaLabel={t('actions')}
                items={[
                  {
                    key: 'view',
                    label: t('view'),
                    onClick: () => setViewingInvoice?.(row),
                  },
                  ...(userRole !== 'viewer' ? [{
                    key: 'edit',
                    label: t('edit'),
                    style: { color: 'var(--noorix-accent-green)' },
                    onClick: () => setEditingInvoice?.(row),
                  }] : []),
                  {
                    key: 'delete',
                    label: t('delete'),
                    style: { color: 'var(--noorix-accent-red)' },
                    onClick: () => confirmAndDeleteInvoice?.(row),
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };
}

export function createInvoiceListMobileCardRenderer({
  t,
  lang,
  STATUS_MAP,
  KIND_MAP,
  userRole,
  companyId,
  setEditingInvoice,
  confirmAndDeleteInvoice,
}: any) {
  return (row: any) => (
    <div>
      <div className="nx-mc__header">
        <span className="nx-cell-num nx-cell-accent text-[14px]">{row.invoiceNumber || '—'}</span>
        <div className="nx-mc__meta">
          <span className="nx-cell-muted-sm">{formatSaudiDateISO(row.transactionDate)}</span>
          <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} size="sm" />
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-1.5 items-stretch text-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge {...Badge.fromStatus(row.kind, KIND_MAP)} size="sm" />
        </div>
        {row.supplierName ? (
          <div className="text-[13px] text-noorix-muted leading-snug break-words">{row.supplierName}</div>
        ) : null}
        {row.createdByDisplayName ? (
          <div className="text-[12px] text-noorix-text leading-snug break-words">
            <span className="text-noorix-muted font-semibold">{t('invoiceUserColumn')}: </span>
            {row.createdByDisplayName}
          </div>
        ) : null}
      </div>
      <div className="mb-2">
        <div className="text-[10px] font-bold text-noorix-muted mb-1 text-end">{t('invoiceVaultColumn')}</div>
        {row.vaultAllocations?.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {row.vaultAllocations.map((al: any) => {
              const vn = lang === 'en' ? al.vault?.nameEn || al.vault?.nameAr : al.vault?.nameAr || al.vault?.nameEn;
              return (
                <div
                  key={al.id}
                  className={cn(
                    'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-noorix-border',
                    'bg-noorix-bg-muted/90 px-2 py-1 shadow-sm',
                  )}
                >
                  <span className="min-w-0 truncate text-[11px] font-semibold text-noorix-text">{vn || '—'}</span>
                  <span dir="ltr" className="shrink-0 text-[12px] font-bold tabular-nums text-nx-sales">
                    <FmtNum n={al.amount} /> <span className="nx-sar">SR</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[12px] text-noorix-muted">
            {row.vault ? (lang === 'en' ? row.vault.nameEn || row.vault.nameAr : row.vault.nameAr || row.vault.nameEn) : '—'}
          </div>
        )}
      </div>
      <div className="nx-mc__grid nx-mc__grid--3">
        <div>
          <div className="nx-mc__stat-label">{t('total')}</div>
          <div className="nx-mc__stat-value">
            <FmtNum n={row.totalAmount} />
          </div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('net')}</div>
          <div className="nx-mc__stat-value nx-cell-num--green text-[13px]">
            <FmtNum n={row.netAmount} />
          </div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('tax')}</div>
          <div className="nx-mc__stat-value nx-cell-num--amber text-[13px]">
            <FmtNum n={row.taxAmount} />
          </div>
        </div>
      </div>
      <div className="nx-mc__actions">
        <InvoiceActionsCell
          row={row}
          userRole={userRole}
          companyId={companyId}
          onPrint={() => window.print()}
          onEdit={(r: any) => setEditingInvoice(r)}
          onDelete={confirmAndDeleteInvoice}
        />
      </div>
    </div>
  );
}
