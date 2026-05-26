/**
 * CompaniesTab — تبويب إدارة الشركات
 */
import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { getCompanies, createCompany, updateCompany, deleteCompany, resetCompanyCategories } from '../../../services/api';
import {
  labelStyle,
  getDeleteCode, setDeleteCode, DEFAULT_DELETE_CODE,
  fileToDataUrl,
} from '../constants/settingsConstants';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import { appKeys, companyKeys } from '../../../services/queryKeys';
import CompanyFinancialInsightThresholdsSection from './CompanyFinancialInsightThresholdsSection';
import { buildCompanyUpdateBody, mergeCompanySavePatch } from '../utils/companyUpdateBody';

export default function CompaniesTab({
  onCompanyCreated,
  userRole,
  userPermissions = [],
}: {
  onCompanyCreated?: (id: unknown) => void;
  userRole?: string;
  userPermissions?: string[];
}) {
  const queryClient = useQueryClient();
  const [includeArchived,    setIncludeArchived]    = useState(false);
  const [showAddForm,        setShowAddForm]        = useState(false);
  const [editModal,          setEditModal]          = useState<any>(null);
  const [deleteConfirmCode,  setDeleteConfirmCode]  = useState('');
  const [deleteCodeSetting,  setDeleteCodeSetting]  = useState(getDeleteCode());

  // نموذج الإضافة
  const [nameAr,   setNameAr]   = useState('');
  const [nameEn,   setNameEn]   = useState('');
  const [taxNumber,setTaxNumber]= useState('');
  const [phone,    setPhone]    = useState('');
  const [address,  setAddress]  = useState('');
  const [email,    setEmail]    = useState('');
  const [logoUrl,  setLogoUrl]  = useState('');

  const { data: companiesList = [], isLoading, isError, refetch } = useQuery({
    queryKey:        appKeys.companies(includeArchived),
    queryFn:         async () => {
      try { const r = await getCompanies(includeArchived); return Array.isArray(r?.data) ? r.data : []; }
      catch { return []; }
    },
    placeholderData: [],
    retry:           false,
  });

  const archivedCompanies = companiesList.filter((c: any) => c.isArchived);
  const showTrulyEmptyState =
    !isLoading && !showAddForm && companiesList.length === 0 && includeArchived;
  const showNoActiveCompaniesHint =
    !isLoading && !showAddForm && companiesList.length === 0 && !includeArchived;

  const resetAddForm = useCallback(() => {
    setNameAr(''); setNameEn(''); setTaxNumber('');
    setPhone(''); setAddress(''); setEmail(''); setLogoUrl('');
    setShowAddForm(false);
  }, []);

  const addMutation = useApiMutation({
    mutationFn: (body: any) => createCompany(body),
    invalidateQueries: [appKeys.companiesRoot()],
    showErrorToast: false,
    onSuccess: (res: any) => {
      const created = res?.data ?? res;
      if (created?.id && onCompanyCreated) onCompanyCreated(created.id);
      resetAddForm();
    },
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: any) => updateCompany(id, body),
    invalidateQueries: [appKeys.companiesRoot(), companyKeys.root()],
    showErrorToast: false,
      successToast: (data: any, variables: any) => {
      if (variables?.body?.isArchived === true) return 'تم أرشفة الشركة.';
      if (variables?.body?.isArchived === false) {
        return 'تم إعادة تفعيل الشركة. ستظهر في قائمة الشركات النشطة والقائمة أعلى النظام.';
      }
      return 'تم حفظ تعديلات الشركة.';
    },
    onSuccess: (res: any, variables: any) => {
      const merged = mergeCompanySavePatch(res, variables);
      if (merged) {
        const { id, patch } = merged;
        queryClient.setQueriesData({ queryKey: appKeys.companiesRoot() }, (prev: any) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((c: any) => (c?.id === id ? { ...c, ...patch } : c));
        });
        queryClient.setQueryData(companyKeys.single(id), (prev: any) => {
          if (!prev || typeof prev !== 'object') return prev;
          return { ...prev, ...patch };
        });
      }
      setEditModal(null);
    },
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: any) => deleteCompany(id),
    invalidateQueries: [appKeys.companiesRoot()],
    showErrorToast: false,
    onSuccess: () => { setEditModal(null); },
  });

  const [resetState, setResetState] = useState<{
    loading: boolean;
    msg: string | null;
    error: string | null;
  }>({ loading: false, msg: null, error: null });

  const handleResetOneCompany = async (companyId: any) => {
    if (!window.confirm('سيتم مسح جميع الفئات وإعادة بنائها للشركة وفق الهيكل الجديد.\n\nالموردون يفقدون ربط الفئة.\nبنود المصروفات تُحذف.\n\nمتأكد؟')) return;
    setResetState({ loading: true, msg: null, error: null });
    try {
      const res = await resetCompanyCategories(companyId);
      if (res?.success) {
        const d = res.data;
        setResetState({ loading: false, msg: `✅ تم — حُذفت ${d.deleted.categories} فئة و${d.deleted.oldAccounts} حساب قديم. أُنشئت ${d.created.categories} فئة جديدة.`, error: null });
      } else {
        setResetState({ loading: false, msg: null, error: res?.error || 'فشل' });
      }
    } catch (e: any) {
      setResetState({ loading: false, msg: null, error: e?.message || 'خطأ غير متوقع' });
    }
  };

  const openEdit = (company: any, e: any) => {
    if (e?.target?.closest?.('button')) return;
    setEditModal({
      id: company.id,
      nameAr: company.nameAr || '',
      nameEn: company.nameEn || '',
      taxNumber: company.taxNumber || '',
      phone: company.phone || '',
      address: company.address || '',
      email: company.email || '',
      logoUrl: company.logoUrl || '',
      isArchived: !!company.isArchived,
      _initial: {
        nameEn: company.nameEn || '',
        taxNumber: company.taxNumber || '',
        phone: company.phone || '',
        address: company.address || '',
        email: company.email || '',
        logoUrl: company.logoUrl || '',
      },
    });
    setDeleteConfirmCode('');
    setDeleteCodeSetting(getDeleteCode());
  };

  const handleLogoFile = async (e: any, isEdit: any = false) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const url = await fileToDataUrl(file);
      const dataUrl = String(url);
      isEdit ? setEditModal((p: any) => ({ ...p, logoUrl: dataUrl })) : setLogoUrl(dataUrl);
    }
    catch (_: any) {}
  };

  const handleDelete = () => {
    if (!editModal?.id) return;
    const code = getDeleteCode();
    if ((deleteConfirmCode || '').trim() !== code) { alert('رقم التأكيد غير صحيح.'); return; }
    if (!window.confirm('حذف الشركة نهائياً؟')) return;
    deleteMutation.mutate(editModal.id);
  };

  return (
    <div className="grid w-full min-w-0 gap-6">
      {isError && (
        <div className="p-3 rounded-lg text-[13px] bg-noorix-red/10 border border-noorix-red">
          لا يمكن الاتصال بالسيرفر.
          <Button size="sm" onClick={() => refetch()} className="mr-2 text-[12px]">إعادة المحاولة</Button>
        </div>
      )}

      {showNoActiveCompaniesHint && (
        <div className="noorix-surface-card text-center p-8 border-2 border-dashed border-noorix-border">
          <div className="text-[40px] mb-3">—</div>
          <h3 className="m-0 mb-2 text-[18px]">لا توجد شركات نشطة</h3>
          <p className="m-0 text-[14px] text-noorix-muted max-w-md mx-auto leading-relaxed">
            إن كانت لديك شركات مؤرشفة، فعّل «عرض المؤرشفة» في الشريط أعلاه ثم اضغط «إعادة التفعيل» على البطاقة أو من نافذة التعديل.
          </p>
          <p className="m-0 mt-3 text-[14px] text-noorix-muted">أو اضغط «إضافة شركة» لإنشاء شركة جديدة.</p>
        </div>
      )}
      {showTrulyEmptyState && (
        <div className="noorix-surface-card text-center p-8 border-2 border-dashed border-noorix-border">
          <div className="text-[40px] mb-3">—</div>
          <h3 className="m-0 mb-2 text-[18px]">لا توجد شركات في النظام</h3>
          <p className="m-0 text-[14px] text-noorix-muted">لم يُسجّل أي شركة لهذا الحساب. استخدم «إضافة شركة» للبدء.</p>
        </div>
      )}

      <div className="nx-toolbar flex-wrap">
        <Button size="sm" variant={showAddForm ? undefined : 'primary'} onClick={() => setShowAddForm((v: any) => !v)}>
          {showAddForm ? 'إلغاء الإضافة' : 'إضافة شركة'}
        </Button>
        <label className="nx-checkbox text-noorix-muted items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={includeArchived} onChange={(e: any) => setIncludeArchived(e.target.checked)} />
          <span>عرض المؤرشفة</span>
          {includeArchived && archivedCompanies.length > 0 && (
            <span className="text-[11px] font-medium text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
              {archivedCompanies.length} مؤرشفة
            </span>
          )}
        </label>
      </div>
      {resetState.msg && (
        <div className="rounded-lg p-3 text-[13px] bg-green-50 border border-green-200 text-green-800">{resetState.msg}</div>
      )}
      {resetState.error && (
        <div className="rounded-lg p-3 text-[13px] bg-noorix-red/10 border border-noorix-red/30 text-noorix-red">{resetState.error}</div>
      )}

      {showAddForm && (
        <div className="noorix-surface-card p-5">
          <h3 className="m-0 mb-4 text-[16px]">إضافة شركة جديدة</h3>
          <form onSubmit={(e: any) => { e.preventDefault(); if (!nameAr.trim()) return; addMutation.mutate({ nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined, taxNumber: taxNumber.trim() || undefined, phone: phone.trim() || undefined, address: address.trim() || undefined, email: email.trim() || undefined, logoUrl: logoUrl.trim() || undefined }); }}
            className="grid w-full min-w-0 max-w-[480px] gap-3">
            <Input type="text" label="الاسم بالعربي *" value={nameAr} onChange={(e: any) => setNameAr(e.target.value)} placeholder="مطعم المعلم الشامي" required />
            <Input type="text" label="الاسم بالإنجليزي" value={nameEn} onChange={(e: any) => setNameEn(e.target.value)} placeholder="Al-Moalem Al-Shami" />
            <Input type="text" label="الرقم الضريبي" value={taxNumber} onChange={(e: any) => setTaxNumber(e.target.value)} placeholder="300000000000003" />
            <Input type="text" label="رقم الهاتف" value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="05xxxxxxxx" />
            <Input type="text" label="العنوان" value={address} onChange={(e: any) => setAddress(e.target.value)} placeholder="الرياض، حي..." />
            <Input type="email" label="البريد الإلكتروني" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="info@example.com" />
            <div>
              <label style={labelStyle}>شعار الشركة</label>
              <Input type="url" value={logoUrl} onChange={(e: any) => setLogoUrl(e.target.value)} placeholder="https://..." />
              <label className="nx-file-label mt-1.5">
                رفع صورة من الجهاز
                <input type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
              </label>
            </div>
            <div className="nx-toolbar">
              <Button type="submit" variant="primary" disabled={addMutation.isPending || !nameAr.trim()}>
                {addMutation.isPending ? 'جاري الإضافة...' : 'حفظ الشركة'}
              </Button>
              <Button type="button" onClick={() => setShowAddForm(false)}>إلغاء</Button>
            </div>
            {addMutation.isError && <p className="m-0 text-[13px] text-noorix-red">{addMutation.error?.message}</p>}
          </form>
        </div>
      )}

      {!isLoading && companiesList.length > 0 && (
        <div className="noorix-exec-card-grid">
          {companiesList.map((c: any) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={(e: any) => openEdit(c, e)}
              onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') openEdit(c, e); }}
              className="noorix-exec-card noorix-exec-card--inbound cursor-pointer"
              style={{ opacity: c.isArchived ? 0.75 : 1 }}
            >
              <div className="noorix-exec-card__stripe" />
              <div className="noorix-exec-card__header">
                <div className="noorix-exec-card__icon">
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt="" className="w-9 h-9 rounded-[9px] object-cover" />
                  ) : (
                    <span className="text-noorix-muted text-[18px]">—</span>
                  )}
                </div>
                <span className="noorix-exec-card__title">{c.nameAr}</span>
              </div>
              <div className="noorix-exec-card__total">
                  <span className="noorix-exec-card__amount text-[18px]">{c.nameEn || c.nameAr}</span>
                <span className="noorix-exec-card__currency text-[12px]">{c.taxNumber ? `الرقم الضريبي: ${c.taxNumber}` : ''}</span>
              </div>
              <div className="noorix-exec-card__divider" />
              <div className="noorix-exec-card__footer">
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">الهاتف</span>
                  <span className="noorix-exec-card__stat-value">{c.phone || '—'}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">البريد</span>
                  <span className="noorix-exec-card__stat-value nx-cell-ellipsis text-[11px]">{c.email || '—'}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">الحالة</span>
                  <span className="noorix-exec-card__stat-value">{c.isArchived ? 'مؤرشفة' : 'نشطة'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 px-[18px] pb-[14px]">
                <span className="text-[12px] text-noorix-muted">اضغط للتعديل</span>
                {c.isArchived ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    className="text-[12px] shrink-0"
                    disabled={updateMutation.isPending}
                    aria-label={`إعادة تفعيل الشركة ${c.nameAr || ''}`}
                    onClick={(e: any) => {
                      e.stopPropagation();
                      updateMutation.mutate({ id: c.id, body: { isArchived: false } });
                    }}
                  >
                    إعادة التفعيل
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <AdaptiveSheet
        open={!!editModal}
        onClose={() => !updateMutation.isPending && !deleteMutation.isPending && setEditModal(null)}
        title={editModal ? `تعديل الشركة — ${editModal.nameAr || '—'}` : ''}
        size="md"
        side="start"
        className="companies-edit-drawer"
        footer={
          <div className="flex items-center justify-end flex flex-wrap gap-2.5">
            {editModal && editModal.isArchived && (
              <Button
                variant="primary"
                onClick={() => updateMutation.mutate({ id: editModal.id, body: { isArchived: false } })}
                disabled={updateMutation.isPending}
                aria-label={`إعادة تفعيل الشركة ${editModal.nameAr || ''}`}
              >
                إعادة التفعيل
              </Button>
            )}
            {editModal && !editModal.isArchived && (
              <Button
                variant="warning"
                onClick={() => {
                  if (!window.confirm('أرشفة هذه الشركة؟ لن تظهر في القوائم حتى تعيد تفعيلها من «عرض المؤرشفة».')) return;
                  updateMutation.mutate({ id: editModal.id, body: { isArchived: true } });
                }}
                disabled={updateMutation.isPending}
              >
                أرشفة
              </Button>
            )}
            <Button onClick={() => setEditModal(null)}>إلغاء</Button>
            <Button type="submit" form="edit-company-form" variant="primary" disabled={updateMutation.isPending || !editModal?.nameAr?.trim()} className="min-w-[120px]">
              {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        }
      >
        {editModal && (
          <>
            {editModal.isArchived ? (
              <div className="mb-4 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950 leading-relaxed">
                <strong className="font-semibold">شركة مؤرشفة:</strong> لا تظهر في قائمة الشركات النشطة ولا في القائمة المنسدلة أعلى النظام. اضغط «إعادة التفعيل» أدناه (أو من زر البطاقة عند تفعيل «عرض المؤرشفة») لإرجاعها إلى العمل.
              </div>
            ) : null}
            <form
              id="edit-company-form"
              onSubmit={(e: any) => {
                e.preventDefault();
                const body = buildCompanyUpdateBody(editModal);
                updateMutation.mutate({
                  id: editModal.id,
                  body,
                });
              }}
              className="grid gap-3.5"
            >
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                <Input type="text" label="الاسم بالعربي *" value={editModal.nameAr} onChange={(e: any) => setEditModal((p: any) => ({ ...p, nameAr: e.target.value }))} required />
                <Input type="text" label="الاسم بالإنجليزي" value={editModal.nameEn} onChange={(e: any) => setEditModal((p: any) => ({ ...p, nameEn: e.target.value }))} />
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                <Input type="text" label="الرقم الضريبي" value={editModal.taxNumber} onChange={(e: any) => setEditModal((p: any) => ({ ...p, taxNumber: e.target.value }))} placeholder="300000000000003" />
                <Input type="text" label="رقم الهاتف" value={editModal.phone} onChange={(e: any) => setEditModal((p: any) => ({ ...p, phone: e.target.value }))} placeholder="05xxxxxxxx" />
              </div>
              <Input type="text" label="العنوان" value={editModal.address} onChange={(e: any) => setEditModal((p: any) => ({ ...p, address: e.target.value }))} placeholder="الرياض، حي..." />
              <Input type="email" label="البريد الإلكتروني" value={editModal.email} onChange={(e: any) => setEditModal((p: any) => ({ ...p, email: e.target.value }))} placeholder="info@example.com" />

              {/* شعار الشركة */}
              <div className="rounded-xl bg-noorix-bg-muted p-3.5 border border-noorix-border">
                <label className="block mb-2.5 text-[14px]">شعار الشركة (يُستخدم في الفواتير والتقارير والشريط الجانبي)</label>
                <div className="flex items-center gap-14">
                  <div className="flex items-center rounded-xl bg-noorix-surface overflow-hidden w-14 h-14 justify-center shrink-0 border-2 border-dashed border-noorix-border">
                    {editModal.logoUrl ? (
                      <img src={editModal.logoUrl} alt="logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-noorix-muted text-[24px]">—</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 grid gap-2">
                    <Input type="url" value={editModal.logoUrl} onChange={(e: any) => setEditModal((p: any) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://رابط-الصورة.com/logo.png" />
                    <label className="nx-file-label">
                      رفع صورة من الجهاز
                      <input type="file" accept="image/*" onChange={(e: any) => handleLogoFile(e, true)} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              {updateMutation.isError && <p className="m-0 text-[13px] rounded-lg py-2 px-3 text-noorix-red bg-noorix-red/10">{updateMutation.error?.message}</p>}
            </form>

            <CompanyFinancialInsightThresholdsSection
              companyId={editModal.id}
              userRole={userRole}
              userPermissions={userPermissions}
            />

            {/* قسم الخطر */}
            <div className="rounded-xl mt-3 p-[14px] bg-noorix-red/5 border border-noorix-red/20">
              <div className="text-[13px] font-bold mb-3 text-noorix-red">⚠ منطقة الخطر</div>
              <div className="grid gap-2.5">
                <div>
                  <div className="text-[12px] text-noorix-muted mb-1.5">
                    إعادة تهيئة الفئات — تمسح الفئات القديمة وتُعيد بناءها بالهيكل الجديد (أكواد P1-1، E3-2 ...).
                    الموردون يفقدون ربط الفئة وبنود المصروفات تُحذف.
                  </div>
                  <Button
                    size="sm"
                    variant="warning"
                    disabled={resetState.loading}
                    onClick={() => handleResetOneCompany(editModal?.id)}
                  >
                    {resetState.loading ? 'جاري إعادة التهيئة...' : '🔄 إعادة تهيئة الفئات لهذه الشركة'}
                  </Button>
                  {resetState.msg && <p className="mt-1.5 text-[12px] text-green-700">{resetState.msg}</p>}
                  {resetState.error && <p className="mt-1.5 text-[12px] text-noorix-red">{resetState.error}</p>}
                </div>
                <div>
                  <label className="block mb-1 text-[11px]">رقم سر الحذف (للضبط)</label>
                  <div className="flex gap-2 flex flex-wrap">
                    <Input type="password" value={deleteCodeSetting} onChange={(e: any) => setDeleteCodeSetting(e.target.value)} placeholder="رقم سري" />
                    <Button onClick={() => { const v = (deleteCodeSetting || '').trim() || DEFAULT_DELETE_CODE; setDeleteCode(v); setDeleteCodeSetting(v); }}>حفظ الرقم</Button>
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-[11px]">أدخل رقم التأكيد لحذف الشركة</label>
                  <div className="flex gap-2 flex flex-wrap">
                    <Input type="password" value={deleteConfirmCode} onChange={(e: any) => setDeleteConfirmCode(e.target.value)} placeholder="رقم التأكيد" />
                    <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? 'جاري...' : 'حذف الشركة'}
                    </Button>
                  </div>
                </div>
                {deleteMutation.isError && <p className="m-0 text-[12px] text-noorix-red">{deleteMutation.error?.message}</p>}
              </div>
            </div>
          </>
        )}
      </AdaptiveSheet>
    </div>
  );
}
