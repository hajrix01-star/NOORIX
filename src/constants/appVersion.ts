export const APP_VERSION_NUMBER = 8;

export function formatAppVersion(version = APP_VERSION_NUMBER): string {
  return `v${version}`;
}
