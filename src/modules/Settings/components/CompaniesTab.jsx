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
import { Button, Input, Modal } from '../../../ui';

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
    <div style={{ display: 'grid', gap: 24 }}>
      {isError && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--noorix-accent-red)', fontSize: 13 }}>
          لا يمكن الاتصال بالسيرفر.
          <Button onClick={() => refetch()} style={{ marginRight: 8, fontSize: 12 }}>إعادة المحاولة</Button>
        </div>
      )}

      {isEmpty && !isLoading && !showAddForm && (
        <div className="noorix-surface-card" style={{ padding: 32, textAlign: 'center', border: '2px dashed var(--noorix-border)', borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>—</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>لا توجد شركات</h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--noorix-text-muted)' }}>اضغط "إضافة شركة" لإنشاء شركتك الأولى.</p>
        </div>
      )}

      <div className="nx-toolbar">
        <Button variant={showAddForm ? undefined : 'primary'} onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'إلغاء الإضافة' : 'إضافة شركة'}
        </Button>
        {!isEmpty && (
          <label className="nx-checkbox" style={{ color: 'var(--noorix-text-muted)' }}>
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            عرض المؤرشفة
          </label>
        )}
      </div>

      {showAddForm && (
        <div className="noorix-surface-card" style={{ padding: 20, border: '1px solid var(--noorix-border)', borderRadius: 12 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>إضافة شركة جديدة</h3>
          <form onSubmit={(e) => { e.preventDefault(); if (!nameAr.trim()) return; addMutation.mutate({ nameAr: nameAr.trim(), nameEn: nameEn.trim() || undefined, taxNumber: taxNumber.trim() || undefined, phone: phone.trim() || undefined, address: address.trim() || undefined, email: email.trim() || undefined, logoUrl: logoUrl.trim() || undefined }); }}
            style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
            <Input type="text" label="الاسم بالعربي *" value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مطعم المعلم الشامي" required />
            <Input type="text" label="الاسم بالإنجليزي" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Al-Moalem Al-Shami" />
            <Input type="text" label="الرقم الضريبي" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="300000000000003" />
            <Input type="text" label="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" />
            <Input type="text" label="العنوان" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="الرياض، حي..." />
            <Input type="email" label="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@example.com" />
            <div>
              <label style={labelStyle}>شعار الشركة</label>
              <Input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
              <input type="file" accept="image/*" onChange={handleLogoFile} style={{ marginTop: 6, fontSize: 13 }} />
            </div>
            <div className="nx-toolbar">
              <Button type="submit" variant="success" disabled={addMutation.isPending || !nameAr.trim()}>
                {addMutation.isPending ? 'جاري الإضافة...' : 'حفظ الشركة'}
              </Button>
              <Button type="button" onClick={() => setShowAddForm(false)}>إلغاء</Button>
            </div>
            {addMutation.isError && <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-accent-red)' }}>{addMutation.error?.message}</p>}
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
              className="noorix-exec-card noorix-exec-card--inbound"
              style={{ opacity: c.isArchived ? 0.75 : 1, cursor: 'pointer' }}
            >
              <div className="noorix-exec-card__stripe" />
              <div className="noorix-exec-card__header">
                <div className="noorix-exec-card__icon">
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 18, color: 'var(--noorix-text-muted)' }}>—</span>
                  )}
                </div>
                <span className="noorix-exec-card__title">{c.nameAr}</span>
              </div>
              <div className="noorix-exec-card__total">
                <span className="noorix-exec-card__amount" style={{ fontSize: 18 }}>{c.nameEn || c.nameAr}</span>
                <span className="noorix-exec-card__currency" style={{ fontSize: 12 }}>{c.taxNumber ? `الرقم الضريبي: ${c.taxNumber}` : ''}</span>
              </div>
              <div className="noorix-exec-card__divider" />
              <div className="noorix-exec-card__footer">
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">الهاتف</span>
                  <span className="noorix-exec-card__stat-value">{c.phone || '—'}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">البريد</span>
                  <span className="noorix-exec-card__stat-value nx-cell-ellipsis" style={{ fontSize: 11 }}>{c.email || '—'}</span>
                </div>
                <div className="noorix-exec-card__stat">
                  <span className="noorix-exec-card__stat-label">الحالة</span>
                  <span className="noorix-exec-card__stat-value">{c.isArchived ? 'مؤرشفة' : 'نشطة'}</span>
                </div>
              </div>
              <div style={{ padding: '8px 18px 14px', fontSize: 12, color: 'var(--noorix-text-muted)' }}>اضغط للتعديل</div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editModal}
        onClose={() => !updateMutation.isPending && !deleteMutation.isPending && setEditModal(null)}
        title={editModal ? `تعديل الشركة — ${editModal.nameAr || '—'}` : ''}
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {editModal && !editModal.isArchived && (
              <Button variant="warning" onClick={() => updateMutation.mutate({ id: editModal.id, body: { isArchived: true } })} disabled={updateMutation.isPending}>أرشفة</Button>
            )}
            <Button onClick={() => setEditModal(null)}>إلغاء</Button>
            <Button type="submit" form="edit-company-form" variant="success" disabled={updateMutation.isPending || !editModal?.nameAr?.trim()} style={{ minWidth: 120 }}>
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
              style={{ display: 'grid', gap: 14 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
                <Input type="text" label="الاسم بالعربي *" value={editModal.nameAr} onChange={(e) => setEditModal((p) => ({ ...p, nameAr: e.target.value }))} required />
                <Input type="text" label="الاسم بالإنجليزي" value={editModal.nameEn} onChange={(e) => setEditModal((p) => ({ ...p, nameEn: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
                <Input type="text" label="الرقم الضريبي" value={editModal.taxNumber} onChange={(e) => setEditModal((p) => ({ ...p, taxNumber: e.target.value }))} placeholder="300000000000003" />
                <Input type="text" label="رقم الهاتف" value={editModal.phone} onChange={(e) => setEditModal((p) => ({ ...p, phone: e.target.value }))} placeholder="05xxxxxxxx" />
              </div>
              <Input type="text" label="العنوان" value={editModal.address} onChange={(e) => setEditModal((p) => ({ ...p, address: e.target.value }))} placeholder="الرياض، حي..." />
              <Input type="email" label="البريد الإلكتروني" value={editModal.email} onChange={(e) => setEditModal((p) => ({ ...p, email: e.target.value }))} placeholder="info@example.com" />

              {/* شعار الشركة */}
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--noorix-bg-muted)', border: '1px solid var(--noorix-border)' }}>
                <label style={{ ...labelStyle, display: 'block', marginBottom: 10 }}>شعار الشركة (يُستخدم في الفواتير والتقارير والشريط الجانبي)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--noorix-bg-surface)', border: '2px dashed var(--noorix-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {editModal.logoUrl ? (
                      <img src={editModal.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 24, color: 'var(--noorix-text-muted)' }}>—</span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                    <Input type="url" value={editModal.logoUrl} onChange={(e) => setEditModal((p) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://رابط-الصورة.com/logo.png" />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--noorix-text-muted)', cursor: 'pointer', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}>
                      رفع صورة من الجهاز
                      <input type="file" accept="image/*" onChange={(e) => handleLogoFile(e, true)} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              </div>

              {updateMutation.isError && <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-accent-red)', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>{updateMutation.error?.message}</p>}
            </form>

            {/* قسم الخطر */}
            <div style={{ marginTop: 24, padding: 14, borderRadius: 12, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--noorix-accent-red)', marginBottom: 12 }}>⚠ منطقة الخطر</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>رقم سر الحذف (للضبط)</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Input type="password" value={deleteCodeSetting} onChange={(e) => setDeleteCodeSetting(e.target.value)} placeholder="رقم سري" />
                    <Button onClick={() => { const v = (deleteCodeSetting || '').trim() || DEFAULT_DELETE_CODE; setDeleteCode(v); setDeleteCodeSetting(v); }}>حفظ الرقم</Button>
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>أدخل رقم التأكيد لحذف الشركة</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Input type="password" value={deleteConfirmCode} onChange={(e) => setDeleteConfirmCode(e.target.value)} placeholder="رقم التأكيد" />
                    <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? 'جاري...' : 'حذف الشركة'}
                    </Button>
                  </div>
                </div>
                {deleteMutation.isError && <p style={{ margin: 0, fontSize: 12, color: 'var(--noorix-accent-red)' }}>{deleteMutation.error?.message}</p>}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
