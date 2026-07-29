import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const violations = [];

const strictFiles = [
  'src/App.tsx',
  'src/AppRoutes.tsx',
  'src/constants/cardStyles.ts',
  'src/modules/themePreview/ThemePreviewScreen.tsx',
  'src/utils/routePrefetch.ts',
  'src/utils/storedLanguage.ts',
  'src/utils/moneyInput.ts',
  'src/utils/jsonStorage.ts',
  'src/utils/exportNormalize.ts',
  'src/utils/format.ts',
  'src/i18n/useTranslation.ts',
  'src/i18n/translations.ts',
  'src/i18n/translations/index.ts',
  'src/ui/Button.tsx',
  'src/ui/Badge.tsx',
  'src/ui/AdaptiveSheet.tsx',
  'src/ui/FilterScrollStrip.tsx',
  'src/ui/SparkLine.tsx',
  'src/components/Toast.tsx',
  'src/components/LoadingFallback.tsx',
  'src/components/SidebarIcons.tsx',
  'src/services/domains/apiEndpoints/companies-ledger-roles.ts',
];

const protectedCompatibilityFiles = [
  'src/types/api/http.ts',
  'src/services/core/apiHttp.ts',
  'src/hooks/useApiMutation.ts',
  'src/hooks/useApiQuery.ts',
];

function abs(rel) {
  return path.join(root, rel);
}

function read(rel) {
  return fs.existsSync(abs(rel)) ? fs.readFileSync(abs(rel), 'utf8') : '';
}

function report(rel, message) {
  violations.push(`${rel}: ${message}`);
}

function inspectStrictFile(rel) {
  const file = abs(rel);
  if (!fs.existsSync(file)) {
    report(rel, 'required system-core file is missing.');
    return;
  }
  const source = fs.readFileSync(file, 'utf8');
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any type is not allowed in closed system-core strict files.' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in closed system-core strict files.' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in closed system-core strict files.' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in closed system-core strict files.' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in closed system-core strict files.' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in closed system-core strict files.' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) report(rel, check.message);
  }
}

for (const rel of strictFiles) inspectStrictFile(rel);

if (fs.existsSync(abs('src/modules/ThemePreviewScreen.tsx'))) {
  report('src/modules/ThemePreviewScreen.tsx', 'orphan ThemePreviewScreen is not allowed; keep it under src/modules/themePreview.');
}

const appSource = read('src/App.tsx');
const appRoutesSource = read('src/AppRoutes.tsx');
if (!appRoutesSource.includes("import('./modules/themePreview/ThemePreviewScreen')")) {
  report('src/AppRoutes.tsx', 'Protected app routes must lazy-load Theme Preview from the themePreview module folder.');
}

const routePrefetchSource = read('src/utils/routePrefetch.ts');
if (!routePrefetchSource.includes("import('../modules/themePreview/ThemePreviewScreen')")) {
  report('src/utils/routePrefetch.ts', 'route prefetch must point to the themePreview module folder.');
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
if (!register.includes('## System Core / Shared Foundation')) {
  report('docs/SECTION_UNIFICATION_REGISTER.md', 'section unification register must document System Core closure.');
}
if (!register.includes('check:system-core-governance')) {
  report('docs/SECTION_UNIFICATION_REGISTER.md', 'System Core closure checks must include check:system-core-governance.');
}

for (const rel of protectedCompatibilityFiles) {
  if (!fs.existsSync(abs(rel))) report(rel, 'protected compatibility boundary file is missing.');
}

if (violations.length) {
  console.error('System Core governance failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('System Core governance passed.');
