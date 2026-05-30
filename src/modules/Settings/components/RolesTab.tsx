/**
 * RolesTab — إدارة الأدوار والصلاحيات.
 * ✅ المصفوفة تُجلب من Backend API — مصدر حقيقة واحد.
 * ✅ محرّر بشاشة كاملة + قسم-قسم + presets + تجميع المحادثة.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { getRoles, getPermissionsSchema, createRole, updateRole, deleteRole } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button } from '../../../ui';
import { appKeys, settingsKeys } from '../../../services/queryKeys';
import { normalizeModuleViewAccess } from '../../../constants/permissions';
import RoleEditorOverlay, { type RoleEditorFormState } from './RoleEditorOverlay';
import type { PermissionModuleShape } from './rolePermissionGroups';

const EMPTY_FORM: RoleEditorFormState = {
  name: '',
  nameAr: '',
  description: '',
  permissions: [],
};

export default function RolesTab({ language }: { userRole?: string; language?: string }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    nameAr: string;
    description: string;
    permissions: string[];
    isSystem: boolean;
  } | null>(null);

  const { data: schema } = useQuery({
    queryKey: settingsKeys.permissionsSchema(),
    queryFn: async () => {
      const res = await getPermissionsSchema();
      return res?.success ? res.data : null;
    },
    staleTime: 30 * 60 * 1000,
  });

  const modules: PermissionModuleShape[] = schema?.modules || [];
  const levels = schema?.levels || {};

  const { data: roles = [], isLoading } = useQuery({
    queryKey: settingsKeys.roles(),
    queryFn: async () => {
      const res = await getRoles();
      return res?.success ? (res.data ?? []) : [];
    },
  });

  const createMutation = useApiMutation({
    mutationFn: createRole,
    invalidateQueries: [settingsKeys.roles()],
    successToast: () => t('roleAdded'),
    errorToast: (e: { message?: string }) => e?.message || t('addFailed'),
    onSuccess: () => {
      setShowForm(false);
    },
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => updateRole(id, body),
    invalidateQueries: [settingsKeys.roles(), appKeys.me()],
    successToast: () => t('updateSuccess'),
    errorToast: (e: { message?: string }) => e?.message || t('updateFailed'),
    onSuccess: () => {
      setEditing(null);
    },
  });

  const deleteMutation = useApiMutation({
    mutationFn: deleteRole,
    invalidateQueries: [settingsKeys.roles()],
    successToast: () => t('roleDeleted'),
    errorToast: (e: { message?: string }) => e?.message || t('deleteFailed'),
    onSuccess: () => {
      setEditing(null);
    },
  });

  function openEdit(r: {
    id: string;
    name: string;
    nameAr?: string;
    description?: string;
    permissions?: string[];
    isSystem?: boolean;
  }) {
    const raw = Array.isArray(r.permissions) ? [...r.permissions] : [];
    setEditing({
      id: r.id,
      name: r.name,
      nameAr: r.nameAr || '',
      description: r.description || '',
      permissions: normalizeModuleViewAccess(modules, raw),
      isSystem: !!r.isSystem,
    });
  }

  const isAr = language === 'ar';
  const allPermCount = modules.flatMap((m) => Object.values(m.permissions)).length;

  function renderPermissionSummary(perms: string[]) {
    if (!Array.isArray(perms)) return '0';
    return `${perms.length} / ${allPermCount}`;
  }

  function renderPermissionBadges(perms: string[]) {
    if (!Array.isArray(perms) || perms.length === 0) {
      return (
        <span className="text-[11px] text-noorix-red">
          {isAr ? 'بدون صلاحيات' : 'No permissions'}
        </span>
      );
    }
    if (perms.length >= allPermCount && allPermCount > 0) {
      return (
        <span className="text-[11px] font-bold text-noorix-blue">
          {isAr ? 'كل الصلاحيات' : 'Full access'}
        </span>
      );
    }
    const activeModules = modules.filter((m) =>
      Object.values(m.permissions).some((p) => perms.includes(p)),
    );
    return (
      <div className="flex flex-wrap gap-1">
        {activeModules.slice(0, 5).map((m) => (
          <span
            key={m.key}
            className="rounded-xl font-semibold py-px px-2 text-[10px] whitespace-nowrap bg-[var(--noorix-blue-10)] text-noorix-blue"
          >
            {m.icon} {isAr ? m.labelAr : m.labelEn}
          </span>
        ))}
        {activeModules.length > 5 && (
          <span className="text-noorix-muted text-[10px]">
            +{activeModules.length - 5}
          </span>
        )}
      </div>
    );
  }


  const [createState, setCreateState] = useState<RoleEditorFormState>(EMPTY_FORM);

  React.useEffect(() => {
    if (showForm) {
      setCreateState(EMPTY_FORM);
    }
  }, [showForm]);

  return (
    <div className="grid gap-4 w-full min-w-0">
      <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between min-[520px]:gap-4">
        <div className="min-w-0">
          <h3 className="m-0 text-[16px] font-bold">
            {isAr ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
          </h3>
          <p className="text-[12px] text-noorix-muted m-0 mt-1">
            {isAr
              ? 'أنشئ أدواراً مخصصة — محرّر بشاشة كاملة مع قوالب جاهزة وتجميع المحادثة'
              : 'Create custom roles — full-screen editor with presets and grouped chat permissions'}
          </p>
        </div>
        <Button
          variant="primary"
          className="w-full min-h-[44px] shrink-0 min-[520px]:w-auto min-[520px]:min-h-0"
          onClick={() => setShowForm(true)}
        >
          {isAr ? '+ إنشاء دور جديد' : '+ Create New Role'}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-noorix-muted p-10">{t('loading')}</div>
      ) : (
        <div className="grid gap-3">
          {roles.map((role: {
            id: string;
            name: string;
            nameAr?: string;
            description?: string;
            permissions?: string[];
            isSystem?: boolean;
            _count?: { users?: number };
          }) => (
            <div
              key={role.id}
              role="button"
              tabIndex={0}
              className="noorix-surface-card cursor-pointer p-4 min-w-0 transition-[box-shadow] duration-150 hover:[box-shadow:var(--noorix-card-shadow-hover)]"
              onClick={() => openEdit(role)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openEdit(role);
                }
              }}
            >
              <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:justify-between min-[480px]:items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-1">
                    <span className="text-[15px] font-bold break-words min-w-0">
                      {role.nameAr || role.name}
                    </span>
                    {role.isSystem && (
                      <span className="rounded-lg font-bold py-px px-2 text-[9px] text-white bg-noorix-muted">
                        {isAr ? 'نظام' : 'System'}
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <div className="text-[12px] text-noorix-muted mb-1.5">{role.description}</div>
                  )}
                  {renderPermissionBadges(role.permissions || [])}
                </div>
                <div className="flex items-stretch justify-start gap-6 sm:gap-10 shrink-0 min-[480px]:justify-end">
                  <div className="text-center min-w-[3.5rem]">
                    <div className="text-[18px] font-bold text-noorix-blue">
                      {role._count?.users ?? 0}
                    </div>
                    <div className="text-noorix-muted text-[11px]">
                      {isAr ? 'مستخدم' : 'users'}
                    </div>
                  </div>
                  <div className="text-center min-w-[3.5rem]">
                    <div className="text-[18px] font-bold">
                      {renderPermissionSummary(role.permissions || [])}
                    </div>
                    <div className="text-noorix-muted text-[11px]">
                      {isAr ? 'صلاحية' : 'perms'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <RoleEditorOverlay
        open={showForm}
        mode="create"
        title={isAr ? 'إنشاء دور جديد' : 'Create New Role'}
        isAr={isAr}
        form={createState}
        onFormChange={(patch) => setCreateState((p) => ({ ...p, ...patch }))}
        modules={modules}
        levels={levels}
        onClose={() => !createMutation.isPending && setShowForm(false)}
        onSave={() => {
          if (!createState.name?.trim()) return;
          createMutation.mutate({
            name: createState.name.trim().toLowerCase().replace(/\s+/g, '_'),
            nameAr: createState.nameAr?.trim(),
            description: createState.description?.trim(),
            permissions: normalizeModuleViewAccess(modules, createState.permissions),
          });
        }}
        isSaving={createMutation.isPending}
        saveLabel={isAr ? 'إنشاء الدور' : 'Create Role'}
        cancelLabel={t('cancel')}
        closeLabel={isAr ? 'رجوع' : 'Back'}
      />

      <RoleEditorOverlay
        open={!!editing}
        mode="edit"
        title={
          editing
            ? (isAr ? `تعديل: ${editing.nameAr || editing.name}` : `Edit: ${editing.nameAr || editing.name}`)
            : ''
        }
        isAr={isAr}
        isSystem={editing?.isSystem}
        form={
          editing
            ? {
                nameAr: editing.nameAr,
                description: editing.description,
                permissions: editing.permissions,
              }
            : EMPTY_FORM
        }
        onFormChange={(patch) => {
          if (!editing) return;
          setEditing((p) => (p ? { ...p, ...patch } : p));
        }}
        modules={modules}
        levels={levels}
        onClose={() => !updateMutation.isPending && setEditing(null)}
        onSave={() => {
          if (!editing) return;
          updateMutation.mutate({
            id: editing.id,
            body: {
              nameAr: editing.nameAr?.trim(),
              description: editing.description?.trim(),
              permissions: normalizeModuleViewAccess(modules, editing.permissions),
            },
          });
        }}
        onDelete={() => {
          if (!editing) return;
          const msg = isAr
            ? `هل تريد حذف الدور "${editing.nameAr || editing.name}"؟`
            : `Delete role "${editing.nameAr || editing.name}"?`;
          if (window.confirm(msg)) deleteMutation.mutate(editing.id);
        }}
        isSaving={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        saveLabel={t('save')}
        cancelLabel={t('close')}
        closeLabel={isAr ? 'رجوع' : 'Back'}
        deleteLabel={isAr ? 'حذف الدور' : 'Delete Role'}
      />
    </div>
  );
}
