import React, { type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Button, FileInput, Input } from '../../../ui';
import { labelStyle } from '../constants/settingsConstants';
import type { SettingsMutationLike } from '../settingsTypes';
import { buildCompanyCreateBody, type CompanyAddFormState, type CompanyCreateBody } from '../companyTabModel';

type CompanyAddFormProps = {
  form: CompanyAddFormState;
  setForm: Dispatch<SetStateAction<CompanyAddFormState>>;
  addMutation: SettingsMutationLike<CompanyCreateBody>;
  onCancel: () => void;
  onLogoFile: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function CompanyAddForm({ form, setForm, addMutation, onCancel, onLogoFile }: CompanyAddFormProps) {
  const setField = (field: keyof CompanyAddFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
  };

  return (
    <div className="noorix-surface-card p-5">
      <h3 className="m-0 mb-4 text-[16px]">إضافة شركة جديدة</h3>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          if (!form.nameAr.trim()) return;
          addMutation.mutate(buildCompanyCreateBody(form));
        }}
        className="grid w-full min-w-0 max-w-[480px] gap-3"
      >
        <Input type="text" label="الاسم بالعربي *" value={form.nameAr} onChange={setField('nameAr')} placeholder="مطعم المعلم الشامي" required />
        <Input type="text" label="الاسم بالإنجليزي" value={form.nameEn} onChange={setField('nameEn')} placeholder="Al-Moalem Al-Shami" />
        <Input type="text" label="الرقم الضريبي" value={form.taxNumber} onChange={setField('taxNumber')} placeholder="300000000000003" />
        <Input type="text" label="رقم الهاتف" value={form.phone} onChange={setField('phone')} placeholder="05xxxxxxxx" />
        <Input type="text" label="العنوان" value={form.address} onChange={setField('address')} placeholder="الرياض، حي..." />
        <Input type="email" label="البريد الإلكتروني" value={form.email} onChange={setField('email')} placeholder="info@example.com" />
        <div>
          <label style={labelStyle}>شعار الشركة</label>
          <Input type="url" value={form.logoUrl} onChange={setField('logoUrl')} placeholder="https://..." />
          <label className="nx-file-label mt-1.5">
            رفع صورة من الجهاز
            <FileInput accept="image/*" onChange={onLogoFile} className="hidden" />
          </label>
        </div>
        <div className="nx-toolbar">
          <Button type="submit" variant="primary" disabled={addMutation.isPending || !form.nameAr.trim()}>
            {addMutation.isPending ? 'جاري الإضافة...' : 'حفظ الشركة'}
          </Button>
          <Button type="button" onClick={onCancel}>إلغاء</Button>
        </div>
        {addMutation.isError && <p className="m-0 text-[13px] text-noorix-red">{addMutation.error?.message}</p>}
      </form>
    </div>
  );
}
