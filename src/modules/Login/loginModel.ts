import { getResolvedLoginEmailDomain } from '../../utils/appBranding';
import type { AuthSessionUser } from '../../types/api';

export type LoginSessionPayload = {
  access_token?: string;
  user?: AuthSessionUser;
};

export function resolveLoginIdentifier(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return `${trimmed.toLowerCase()}@${getResolvedLoginEmailDomain()}`;
}

export function loginErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
