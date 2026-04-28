import React, { type RefObject, type ReactNode } from 'react';

export function EmployeeDocPrintFrame({ printRef, children }: { printRef: React.RefObject<HTMLDivElement | null>; children: ReactNode }) {
  return <div ref={printRef as React.RefObject<HTMLDivElement>}>{children}</div>;
}
