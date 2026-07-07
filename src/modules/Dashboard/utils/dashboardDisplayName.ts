import type { DashboardNamedEntity } from '../../../types/api/domains/dashboard';
import { localizedDisplayName } from '../../../utils/displayName';

export function dashboardDisplayName(
  source: DashboardNamedEntity | null | undefined,
  lang: string,
  fallback = '',
): string {
  return localizedDisplayName(source, lang, fallback);
}
