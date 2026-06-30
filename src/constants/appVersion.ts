export const APP_VERSION_NUMBER = 5;

export function formatAppVersion(version = APP_VERSION_NUMBER): string {
  return `v${version}`;
}
