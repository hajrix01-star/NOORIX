import React, { createContext, useContext } from 'react';
import type { AppContextValue } from './appTypes';

/**
 * سياق التطبيق الموحد: الشركة النشطة، المستخدم، الصلاحيات، الثيم، اللغة، القائمة الجانبية.
 * تُوفَّر القيمة من `App.tsx`؛ أي مكوّن يمكنه useApp() للوصول دون تمرير props.
 */
const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppContext.Provider');
  }
  return ctx;
}

export { AppContext };
