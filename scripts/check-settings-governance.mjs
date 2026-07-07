import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const settingsRoot = path.join(root, 'src', 'modules', 'Settings');
const violations = [];

const strictFiles = [
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'backup.ts'),
];

const requiredFiles = [
  path.join(settingsRoot, 'settingsTypes.ts'),
  path.join(settingsRoot, 'settingsScreenModel.ts'),
  path.join(settingsRoot, 'companyTabModel.ts'),
  path.join(settingsRoot, 'usersTabModel.ts'),
  path.join(settingsRoot, 'utils', 'companyUpdateBody.ts'),
  path.join(settingsRoot, 'utils', 'companyInsightThresholdsForm.ts'),
  path.join(settingsRoot, 'components', 'backup', 'backupTabHelpers.ts'),
  path.join(settingsRoot, 'components', 'backup', 'backupTabHelpers.test.ts'),
];

function report(filePath, message) {
  violations.push(`${path.relative(root, filePath)}: ${message}`);
}

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function collectCodeFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCodeFiles(fullPath);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name)) strictFiles.push(fullPath);
  }
}

function inspectStrictFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const source = read(filePath);
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any type is not allowed in settings closure scope.' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in settings closure scope.' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in settings closure scope.' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in settings closure scope.' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in settings closure scope.' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in settings closure scope.' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) report(filePath, check.message);
  }
}

for (const requiredFile of requiredFiles) {
  if (!fs.existsSync(requiredFile)) report(requiredFile, 'required settings centrality file is missing.');
}

collectCodeFiles(settingsRoot);
for (const strictFile of strictFiles) inspectStrictFile(strictFile);

for (const strictFile of strictFiles) {
  const source = read(strictFile);
  if (/<table\b/.test(source)) report(strictFile, 'raw JSX table is not allowed in settings closure scope.');
  if (/useQuery\s*\(|useMutation\s*\(/.test(source)) {
    report(strictFile, 'raw query/mutation hooks are not allowed in settings closure scope.');
  }
}

const settingsScreenPath = path.join(settingsRoot, 'SettingsScreen.tsx');
const settingsScreen = read(settingsScreenPath);
if (!settingsScreen.includes('./settingsScreenModel')) {
  report(settingsScreenPath, 'SettingsScreen must delegate tab/filter shaping to settingsScreenModel.');
}
if (/hasPermission\(|\.filter\([^)]*permission/.test(settingsScreen)) {
  report(settingsScreenPath, 'SettingsScreen must not own permission tab filtering inline.');
}

const backupApiPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'backup.ts');
const backupApi = read(backupApiPath);
if (/fetch\s*\(/.test(backupApi)) {
  report(backupApiPath, 'backup downloads/uploads must use central safeFetch helpers, not raw fetch.');
}
if (!backupApi.includes('downloadBackupBlob') || !backupApi.includes('uploadBackupForm')) {
  report(backupApiPath, 'backup API must centralize blob downloads and archive uploads.');
}

const backupTabPath = path.join(settingsRoot, 'components', 'BackupTab.tsx');
const backupTab = read(backupTabPath);
if (!backupTab.includes('./backup')) {
  report(backupTabPath, 'BackupTab must compose centralized backup sections through the backup barrel.');
}
if (/FileReader|fetch\s*\(|<table\b/.test(backupTab)) {
  report(backupTabPath, 'BackupTab must not own file parsing, raw fetch, or raw tables.');
}

const companiesPath = path.join(settingsRoot, 'components', 'CompaniesTab.tsx');
const companiesSource = read(companiesPath);
if (!companiesSource.includes('../utils/companyUpdateBody')) {
  report(companiesPath, 'CompaniesTab must delegate company update body shaping to companyUpdateBody.');
}

const registerPath = path.join(root, 'docs', 'SECTION_UNIFICATION_REGISTER.md');
const register = read(registerPath);
if (!register.includes('## Settings') || !register.includes('check:settings-governance')) {
  report(registerPath, 'section unification register must document settings closure and governance.');
}

if (violations.length) {
  console.error('Settings governance failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Settings governance passed.');
