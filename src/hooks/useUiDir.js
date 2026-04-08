import { useApp } from '../context/AppContext';

/** اتجاه واجهة التطبيق حسب اللغة: عربي → rtl، إنجليزي → ltr */
export function useUiDir() {
  const { language } = useApp();
  return language === 'ar' ? 'rtl' : 'ltr';
}
