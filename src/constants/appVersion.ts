export const APP_VERSION_NUMBER = 1;

export function formatAppVersion(version = APP_VERSION_NUMBER): string {
  return `v${version}`;
}
