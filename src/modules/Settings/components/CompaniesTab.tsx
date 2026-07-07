/**
 * CompaniesTab — تبويب إدارة الشركات
 */
import React, { type ChangeEvent, type FormEvent, type MouseEvent, type KeyboardEvent, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  resetCompanyCategories,
} from '../../../services/api';
import { fileToDataUrl } from '../constants/settingsConstants';
import { Button, Checkbox, FileInput, Input, AdaptiveSheet, FilterToolbar } from '../../../ui';
import { appKeys, companyKeys } from '../../../services/queryKeys';
import CompanyFinancialInsightThresholdsSection from './CompanyFinancialInsightThresholdsSection';
import { buildCompanyUpdateBody, mergeCompanySavePatch } from '../utils/companyUpdateBody';
import type { SettingsCompany } from '../settingsTypes';
import { CompanyAddForm } from './CompanyAddForm';
import { CompanyCardsGrid } from './CompanyCardsGrid';
import {
  buildCompanyEditModal,
  EMPTY_COMPANY_ADD_FORM,
  resetCompanyCategoriesSuccessMessage,
  type CompanyAddFormState,
  type CompanyCreateBody,
  type CompanyEditModal,
  type CompanyMutationResult,
  type CompanyUpdateResult,
  type CompanyUpdateVariables,
  type ResetCompanyCategoriesResult,
} from '../companyTabModel';

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
  const [editModal,          setEditModal]          = useState<CompanyEditModal | null>(null);
  const [deleteConfirmCode,  setDeleteConfirmCode]  = useState('');

  const [addForm, setAddForm] = useState<CompanyAddFormState>(EMPTY_COMPANY_ADD_FORM);

  const { data: companiesList = [], isLoading, isError, refetch } = useApiListQuery<SettingsCompany>({
    queryKey:        appKeys.companies(includeArchived),
    queryFn:         () => getCompanies(includeArchived),
    fallbackMessage: 'فشل تحميل الشركات',
    placeholderData: [],
    retry:           false,
  });

  const archivedCompanies = companiesList.filter((company) => company.isArchived);
  const showTrulyEmptyState =
    !isLoading && !showAddForm && companiesList.length === 0 && includeArchived;
  const showNoActiveCompaniesHint =
    !isLoading && !showAddForm && companiesList.length === 0 && !includeArchived;

  const resetAddForm = useCallback(() => {
    setAddForm(EMPTY_COMPANY_ADD_FORM);
    setShowAddForm(false);
  }, []);

  const addMutation = useApiMutation({
    mutationFn: (body: CompanyCreateBody) => createCompany(body),
    invalidateQueries: [appKeys.companiesRoot()],
    showErrorToast: false,
    onSuccess: (res: CompanyMutationResult) => {
      const created = res?.data ?? res;
      if (created?.id && onCompanyCreated) onCompanyCreated(created.id);
      resetAddForm();
    },
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: CompanyUpdateVariables) => updateCompany(id, body),
    invalidateQueries: [appKeys.companiesRoot(), companyKeys.root()],
    showErrorToast: false,
      successToast: (_data: unknown, variables: CompanyUpdateVariables) => {
      if (variables?.body?.isArchived === true) return 'تم أرشفة الشركة.';
      if (variables?.body?.isArchived === false) {
        return 'تم إعادة تفعيل الشركة. ستظهر في قائمة الشركات النشطة والقائمة أعلى النظام.';
      }
      return 'تم حفظ تعديلات الشركة.';
    },
    onSuccess: (res: CompanyUpdateResult, variables: CompanyUpdateVariables) => {
      const merged = mergeCompanySavePatch(res, variables);
      if (merged) {
        const { id, patch } = merged;
        queryClient.setQueriesData({ queryKey: appKeys.companiesRoot() }, (prev: unknown) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((company) => {
            if (!company || typeof company !== 'object' || !('id' in company)) return company;
            return company.id === id ? { ...company, ...patch } : company;
          });
        });
        queryClient.setQueryData(companyKeys.single(id), (prev: unknown) => {
          if (!prev || typeof prev !== 'object') return prev;
          return { ...prev, ...patch };
        });
      }
      setEditModal(null);
    },
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => deleteCompany(id),
    invalidateQueries: [appKeys.companiesRoot()],
    showErrorToast: false,
    onSuccess: () => { setEditModal(null); },
  });

  const [resetState, setResetState] = useState<{
    loading: boolean;
    msg: string | null;
    error: string | null;
  }>({ loading: false, msg: null, error: null });

  const handleResetOneCompany = async (companyId: string) => {
    if (!window.confirm('سيتم مسح جميع الفئات وإعادة بنائها للشركة وفق الهيكل الجديد.\n\nالموردون يفقدون ربط الفئة.\nبنود المصروفات تُحذف.\n\nمتأكد؟')) return;
    setResetState({ loading: true, msg: null, error: null });
    try {
      const res = await resetCompanyCategories(companyId) as ResetCompanyCategoriesResult;
      if (res?.success) {
        const d = res.data;
        setResetState({ loading: false, msg: resetCompanyCategoriesSuccessMessage(res), error: null });
      } else {
        setResetState({ loading: false, msg: null, error: res?.error || 'فشل' });
      }
    } catch (error: unknown) {
      setResetState({ loading: false, msg: null, error: error instanceof Error ? error.message : 'خطأ غير متوقع' });
    }
  };

  const openEdit = (company: SettingsCompany, event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest('button')) return;
    setEditModal(buildCompanyEditModal(company));
    setDeleteConfirmCode('');
  };

  const handleLogoFile = async (event: ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const url = await fileToDataUrl(file);
      const dataUrl = String(url);
      if (isEdit) {
        setEditModal((previous) => (previous ? { ...previous, logoUrl: dataUrl } : previous));
      } else {
        setAddForm((previous) => ({ ...previous, logoUrl: dataUrl }));
      }
    } catch {
    }
  };

  const handleDelete = () => {
    if (!editModal?.id) return;
    const expected = String(editModal?.nameAr || editModal?.nameEn || '').trim();
    if (!expected || (deleteConfirmCode || '').trim() !== expected) {
      alert('اكتب اسم الشركة كما هو لتأكيد الحذف.');
      return;
    }
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

      <FilterToolbar variant="bare" className="nx-toolbar flex-wrap">
        <Button size="sm" variant={showAddForm ? undefined : 'primary'} onClick={() => setShowAddForm((value) => !value)}>
          {showAddForm ? 'إلغاء الإضافة' : 'إضافة شركة'}
        </Button>
        <div className="nx-checkbox text-noorix-muted items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={includeArchived}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setIncludeArchived(event.target.checked)}
            label="عرض المؤرشفة"
          />
          {includeArchived && archivedCompanies.length > 0 && (
            <span className="text-[11px] font-medium text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
              {archivedCompanies.length} مؤرشفة
            </span>
          )}
        </div>
      </FilterToolbar>
      {resetState.msg && (
        <div className="rounded-lg p-3 text-[13px] bg-green-50 border border-green-200 text-green-800">{resetState.msg}</div>
      )}
      {resetState.error && (
        <div className="rounded-lg p-3 text-[13px] bg-noorix-red/10 border border-noorix-red/30 text-noorix-red">{resetState.error}</div>
      )}

      {showAddForm && (
        <CompanyAddForm
          form={addForm}
          setForm={setAddForm}
          addMutation={addMutation}
          onCancel={() => setShowAddForm(false)}
          onLogoFile={handleLogoFile}
        />
      )}

      {!isLoading && companiesList.length > 0 && (
        <CompanyCardsGrid companies={companiesList} updateMutation={updateMutation} onOpenEdit={openEdit} />
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
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const body = buildCompanyUpdateBody(editModal);
                updateMutation.mutate({
                  id: editModal.id,
                  body,
                });
              }}
              className="grid gap-3.5"
            >
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                <Input type="text" label="الاسم بالعربي *" value={editModal.nameAr} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditModal((previous) => (previous ? { ...previous, nameAr: event.target.value } : previous))} required />
                <Input type="text" label="الاسم بالإنجليزي" value={editModal.nameEn} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditModal((previous) => (previous ? { ...previous, nameEn: event.target.value } : previous))} />
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                <Input type="text" label="الرقم الضريبي" value={editModal.taxNumber} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditModal((previous) => (previous ? { ...previous, taxNumber: event.target.value } : previous))} placeholder="300000000000003" />
                <Input type="text" label="رقم الهاتف" value={editModal.phone} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditModal((previous) => (previous ? { ...previous, phone: event.target.value } : previous))} placeholder="05xxxxxxxx" />
              </div>
              <Input type="text" label="العنوان" value={editModal.address} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditModal((previous) => (previous ? { ...previous, address: event.target.value } : previous))} placeholder="الرياض، حي..." />
              <Input type="email" label="البريد الإلكتروني" value={editModal.email} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditModal((previous) => (previous ? { ...previous, email: event.target.value } : previous))} placeholder="info@example.com" />

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
                    <Input type="url" value={editModal.logoUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditModal((previous) => (previous ? { ...previous, logoUrl: event.target.value } : previous))} placeholder="https://رابط-الصورة.com/logo.png" />
                    <label className="nx-file-label">
                      رفع صورة من الجهاز
                      <FileInput accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => handleLogoFile(event, true)} className="hidden" />
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
                  <label className="block mb-1 text-[11px]">اكتب اسم الشركة لتأكيد الحذف</label>
                  <div className="flex gap-2 flex flex-wrap">
                    <Input value={deleteConfirmCode} onChange={(event: ChangeEvent<HTMLInputElement>) => setDeleteConfirmCode(event.target.value)} placeholder={editModal?.nameAr || editModal?.nameEn || 'اسم الشركة'} />
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
