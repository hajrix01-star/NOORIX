import React from 'react';

type FilterToolbarProps = {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export default function FilterToolbar({ children, actions, className = '' }: FilterToolbarProps) {
  return (
    <div className={`noorix-print-hide nx-filter-toolbar ${className}`.trim()}>
      <div className="nx-filter-toolbar__filters">{children}</div>
      {actions && <div className="nx-filter-toolbar__actions">{actions}</div>}
    </div>
  );
}
