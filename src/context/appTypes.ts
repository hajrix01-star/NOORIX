import type { Dispatch, SetStateAction } from 'react';
import type { AuthSessionUser } from '../types/api';

/** عنصر شركة في المبدّل والهيدر — يطابق `getCompanies` والبدائل المبنية من JWT */
export type CompanyListItem = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  logoUrl?: string | null;
  /** بعض الشاشات تعرض اسمًا موحّداً */
  name?: string | null;
  taxNumber?: string | null;
};

/** قيمة `AppContext` — تُبنى في `App.tsx` */
export type AppContextValue = {
  activeCompany: string;
  activeCompanyId: string;
  setActiveCompany: (id: string) => void;
  companies: CompanyListItem[];
  hasRealCompanies: boolean;
  cardStyle: number;
  setCardStyle: Dispatch<SetStateAction<number>>;
  language: string;
  setLanguage: Dispatch<SetStateAction<string>>;
  isSidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  user: AuthSessionUser | null;
  userRole: string | undefined;
  userPermissions: string[];
};
