import { localizedDisplayName, type LocalizedDisplaySource } from './displayName';

export type VaultDisplaySource = LocalizedDisplaySource;
export { localizedDisplayName };

export function vaultDisplayName(vault: VaultDisplaySource | null | undefined, lang: string) {
  return localizedDisplayName(vault, lang);
}
