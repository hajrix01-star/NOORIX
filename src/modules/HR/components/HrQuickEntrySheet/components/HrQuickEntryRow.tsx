import React from 'react';

export function HrQuickEntryRow({
  id,
  label,
  children,
  error,
}: {
  id?: string;
  label?: React.ReactNode;
  children?: React.ReactNode;
  error?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="text-[13px] font-semibold mb-1.5 block">
        {label}
      </label>
      {children}
      {error && (
        <div className="mt-1 text-[12px] text-noorix-red">
          {error}
        </div>
      )}
    </div>
  );
}
