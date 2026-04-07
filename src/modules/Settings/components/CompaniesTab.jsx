/**
 * CompaniesTab — تبويب إدارة الشركات
 */
import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompanies, createCompany, updateCompany, deleteCompany } from '../../../services/api';
import {
  labelStyle,
  getDeleteCode, setDeleteCode, DEFAULT_DELETE_CODE,
  fileToDataUrl,
} from '../constants/settingsConstants';
import { Button, Input, Drawer } from '../../../ui';

export default function CompaniesTab({ onCompanyCreated }) {
  const queryClient = useQueryClient();

  const [includeArchived,    setIncludeArchived]    = useState(false);
  const [showAddForm,        setShowAddForm]        = useState(false);
  const [editModal,          setEditModal]          = useState(null);
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
    queryKey:        ['companies', includeArchived],
    queryFn:         async () => {
      try { const r = await getCompanies(includeArchived); return Array.isArray(r?.data) ? r.data : []; }
      catch { return []; }
    },
    placeholderData: [],
    retry:           false,
  });

  const activeCompanies = companiesList.filter((c) => !c.isArchived);
  const isEmpty = activeCompanies.length === 0 && !includeArchived;

  const resetAddForm = useCallback(() => {
    setNameAr(''); setNameEn(''); setTaxNumber('');
    setPhone(''); setAddress(''); setEmail(''); setLogoUrl('');
    setShowAddForm(false);
  }, []);

  const addMutation = useMutation({
    mutationFn: async (body) => {
      const res = await createCompany(body);
      if (!res || !res.success) throw new Error(res?.error || 'فشل إضافة الشركة');
      return res.data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      if (created?.id && onCompanyCreated) onCompanyCreated(created.id);
      resetAddForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }) => {
      const res = await updateCompany(id, body);
      if (!res || !res.success) throw new Error(res?.error || 'فشل تحديث الشركة');
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); setEditModal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await deleteCompany(id);
      if (!res || !res.success) throw new Error(res?.error || 'فشل حذف الشركة');
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); setEditModal(null); },
  });

  const openEdit = (company, e) => {
    if (e?.target?.closest?.('button')) return;
    setEditModal({ id: company.id, nameAr: company.nameAr || '', nameEn: company.nameEn || '', taxNumber: company.taxNumber || '', phone: company.phone || '', address: company.address || '', email: company.email || '', logoUrl: company.logoUrl || '', isArchived: !!company.isArchived });
    setDeleteConfirmCode('');
    setDeleteCodeSetting(getDeleteCode());
  };

  const handleLogoFile = async (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try { const url = await fileToDataUrl(file); isEdit ? setEditModal((p) => ({ ...p, logoUrl: url })) : setLogoUrl(url); }
    catch (_) {}
  };

  const handleDelete = () => {
    if (!editModal?.id) return;
    const code = getDeleteCode();
    if ((deleteConfirmCode || '').trim() !== code) { alert('رقم التأكيد غير صحيح.'); return; }
    if (!window.confirm('حذف الشركة نهائياً؟')) return;
    deleteMutation.mutate(editModal.id);
  };

  return (
    <div className="nx-grid nx-gap-24">
      {isError && (
        <div className="nx-p-12 nx-rounded nx-text-base" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--noorix-accent-red)' }}>
          لا يمكن الاتصال بالسيرفر.
          <Button onClick={() => refetch()} style={{ marginRight: 8, fontSize: 12 }}>إعادة المحاولة</Button>
        </div>
      )}

      {isEmpty && !isLoading && !showAddForm && (
        <div className="noorix-surface-card nx-text-center nx-rounded-lg" style={{ padding: 32, border: '2px dashed var(--noorix-border)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>—</div>
          <h3 className="nx-m-0 nx-mb-8 nx-text-2xl">لا توجد شركات</h3>
          <p className="nx-m-0 nx-text-md nx-text-muted">اضغط "إضافة شركة" لإنشاء شركتك الأولى.</p>
        </div>
      )}

      <div className="nx-toolbar">
        <Button variant={showAddForm ? undefined : 'primary'} onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'إلغاء الإضافة' : 'إضافة شركة'}
        </Button>
        {!isEmpty && (
          <label className="nx-checkbox nx-text-muted">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            عرض المؤرشفة
          </label>
        )}
      </div>

      {showAddForm && (
        <div className="noorix-surface-card nx-p-20 nx-rounded-lg nx-border-all">
          <h3 className="nx-m-0 nx-mb-16 nx-text-xl">إضافة شركة جديدة</h3>
          <form onSubmit={(e) => { e.preventDefault(); if (!nameAr.trim()) return; addMutation.mutate({ nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined, taxNumber: taxNumber.trim() || undefined, phone: phone.trim() || undefined, address: address.trim() || undefined, email: email.trim() || undefined, logoUrl: logoUrl.trim() || undefined }); }}
            className="nx-grid nx-gap-12" style={{ maxWidth: 480 }}>
            <Input type="text" label="الاسم بالعربي *" value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مطعم المعلم الشامي" required />
            <Input type="text" label="الاسم بالإنجليزي" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Al-Moalem Al-Shami" />
            <Input type="text" label="الرقم الضريبي" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="300000000000003" />
            <Input type="text" label="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" />
            <Input type="text" label="العنوان" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="الرياض، حي..." />
            <Input type="email" label="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@example.com" />
            <div>
              <label style={labelStyle}>شعار الشركة</label>
              <Input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
              <label className="nx-file-label" style={{ marginTop: 6 }}>
                رفع صورة من الجهاز
                <input type="file" accept="image/*" onChange={handleLogoFile} style={{ display: 'none' }} />
              </label>
            </div>
            <div className="nx-toolbar">
              <Button type="submit" variant="primary" disabled={addMutation.isPending || !nameAr.trim()}>
                {addMutation.isPending ? 'جاري الإضافة...' : 'حفظ الشركة'}
              </Button>
              <Button type="button" onClick={() => setShowAddForm(false)}>إلغاء</Button>
            </div>
            {addMutation.isError && <p className="nx-m-0 nx-text-base" style={{ color: 'var(--noorix-accent-red)' }}>{addMutation.error?.message}</p>}
          </form>
        </div>
      )}

      {!isLoading && companiesList.length > 0 && (
        <div className="noorix-exec-card-grid">
          {companiesList.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={(e) => openEdit(c, e)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEdit(c, e); }}
              className="noorix-exec-card noorix-exec-card--inbound nx-cursor-pointer"
              style={{ opacity: c.isArchived ? 0.75 : 1 }}
            >
              <div className="noorix-exec-card__stripe" />
              <div className="noorix-exec-card__header">
                <div className="noorix-exec-card__icon">
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover' }} />
                  ) : (
                    <span className="nx-text-muted" style={{ fontSize: 18 }}>—</span>
                  )}
                </div>
                <span className="noorix-exec-card__title">{c.nameAr}</span>
              </div>
              <div className="noorix-exec-card__total">
                  <span className="noorix-exec-card__amount nx-text-2xl">{c.nameEn || c.nameAr}</span>
                <span className="noorix-exec-card__currency nx-text-sm">{c.taxNumber ? `الرقم الضريبي: ${c.taxNumber}` : ''}</span>
              </div>
              <div className="noorix-exec-card__divider" />
              <div className="noorix-exec-card__footer">
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">الهاتف</span>
                  <span className="noorix-exec-card__stat-value">{c.phone || '—'}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">البريد</span>
                  <span className="noorix-exec-card__stat-value nx-cell-ellipsis nx-text-xs">{c.email || '—'}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">الحالة</span>
                  <span className="noorix-exec-card__stat-value">{c.isArchived ? 'مؤرشفة' : 'نشطة'}</span>
                </div>
              </div>
              <div className="nx-text-sm nx-text-muted" style={{ padding: '8px 18px 14px' }}>اضغط للتعديل</div>
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={!!editModal}
        onClose={() => !updateMutation.isPending && !deleteMutation.isPending && setEditModal(null)}
        title={editModal ? `تعديل الشركة — ${editModal.nameAr || '—'}` : ''}
        size="md"
        side="start"
        className="companies-edit-drawer"
        footer={
          <div className="nx-flex-end nx-flex-wrap nx-gap-10">
            {editModal && !editModal.isArchived && (
              <Button variant="warning" onClick={() => updateMutation.mutate({ id: editModal.id, body: { isArchived: true } })} disabled={updateMutation.isPending}>أرشفة</Button>
            )}
            <Button onClick={() => setEditModal(null)}>إلغاء</Button>
            <Button type="submit" form="edit-company-form" variant="primary" disabled={updateMutation.isPending || !editModal?.nameAr?.trim()} style={{ minWidth: 120 }}>
              {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        }
      >
        {editModal && (
          <>
            <form
              id="edit-company-form"
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({ id: editModal.id, body: { nameAr: editModal.nameAr.trim(), nameEn: editModal.nameEn.trim() || undefined, taxNumber: editModal.taxNumber.trim() || undefined, phone: editModal.phone.trim() || undefined, address: editModal.address.trim() || undefined, email: editModal.email.trim() || undefined, logoUrl: editModal.logoUrl.trim() || undefined } });
              }}
              className="nx-grid nx-gap-14"
            >
              <div className="nx-grid nx-gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
                <Input type="text" label="الاسم بالعربي *" value={editModal.nameAr} onChange={(e) => setEditModal((p) => ({ ...p, nameAr: e.target.value }))} required />
                <Input type="text" label="الاسم بالإنجليزي" value={editModal.nameEn} onChange={(e) => setEditModal((p) => ({ ...p, nameEn: e.target.value }))} />
              </div>
              <div className="nx-grid nx-gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
                <Input type="text" label="الرقم الضريبي" value={editModal.taxNumber} onChange={(e) => setEditModal((p) => ({ ...p, taxNumber: e.target.value }))} placeholder="300000000000003" />
                <Input type="text" label="رقم الهاتف" value={editModal.phone} onChange={(e) => setEditModal((p) => ({ ...p, phone: e.target.value }))} placeholder="05xxxxxxxx" />
              </div>
              <Input type="text" label="العنوان" value={editModal.address} onChange={(e) => setEditModal((p) => ({ ...p, address: e.target.value }))} placeholder="الرياض، حي..." />
              <Input type="email" label="البريد الإلكتروني" value={editModal.email} onChange={(e) => setEditModal((p) => ({ ...p, email: e.target.value }))} placeholder="info@example.com" />

              {/* شعار الشركة */}
              <div className="nx-rounded-lg nx-bg-muted nx-p-14 nx-border-all">
                <label style={{ ...labelStyle, display: 'block', marginBottom: 10 }}>شعار الشركة (يُستخدم في الفواتير والتقارير والشريط الجانبي)</label>
                <div className="nx-flex-center nx-gap-14">
                  <div className="nx-flex-center nx-rounded-lg nx-bg-surface nx-overflow-hidden" style={{ width: 56, height: 56, border: '2px dashed var(--noorix-border)', justifyContent: 'center', flexShrink: 0 }}>
                    {editModal.logoUrl ? (
                      <img src={editModal.logoUrl} alt="logo" className="nx-w-full" style={{ height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="nx-text-muted" style={{ fontSize: 24 }}>—</span>
                    )}
                  </div>
                  <div className="nx-flex-1 nx-grid nx-gap-8">
                    <Input type="url" value={editModal.logoUrl} onChange={(e) => setEditModal((p) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://رابط-الصورة.com/logo.png" />
                    <label className="nx-file-label">
                      رفع صورة من الجهاز
                      <input type="file" accept="image/*" onChange={(e) => handleLogoFile(e, true)} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              </div>

              {updateMutation.isError && <p className="nx-m-0 nx-text-base nx-rounded" style={{ color: 'var(--noorix-accent-red)', padding: '8px 12px', background: 'rgba(239,68,68,0.08)' }}>{updateMutation.error?.message}</p>}
            </form>

            {/* قسم الخطر */}
            <div className="nx-rounded-lg" style={{ marginTop: 24, padding: 14, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="nx-text-base nx-font-700 nx-mb-12" style={{ color: 'var(--noorix-accent-red)' }}>⚠ منطقة الخطر</div>
              <div className="nx-grid nx-gap-10">
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>رقم سر الحذف (للضبط)</label>
                  <div className="nx-flex nx-gap-8 nx-flex-wrap">
                    <Input type="password" value={deleteCodeSetting} onChange={(e) => setDeleteCodeSetting(e.target.value)} placeholder="رقم سري" />
                    <Button onClick={() => { const v = (deleteCodeSetting || '').trim() || DEFAULT_DELETE_CODE; setDeleteCode(v); setDeleteCodeSetting(v); }}>حفظ الرقم</Button>
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>أدخل رقم التأكيد لحذف الشركة</label>
                  <div className="nx-flex nx-gap-8 nx-flex-wrap">
                    <Input type="password" value={deleteConfirmCode} onChange={(e) => setDeleteConfirmCode(e.target.value)} placeholder="رقم التأكيد" />
                    <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? 'جاري...' : 'حذف الشركة'}
                    </Button>
                  </div>
                </div>
                {deleteMutation.isError && <p className="nx-m-0 nx-text-sm" style={{ color: 'var(--noorix-accent-red)' }}>{deleteMutation.error?.message}</p>}
              </div>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
