import { localizedDisplayName, type DisplayLanguage, type LocalizedDisplaySource } from './displayName';

export type EmployeeDisplayNameSource = object & LocalizedDisplaySource;

export type EmployeeDisplayLanguage = DisplayLanguage;

export function employeeDisplayName(
  entity: EmployeeDisplayNameSource | null | undefined,
  lang: EmployeeDisplayLanguage,
  fallback: string = '\u2014',
) {
  return localizedDisplayName(entity, lang, fallback);
}
