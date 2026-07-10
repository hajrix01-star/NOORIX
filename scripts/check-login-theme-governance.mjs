import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const loginRoot = path.join(root, 'src', 'modules', 'Login');
const themeRoot = path.join(root, 'src', 'modules', 'themePreview');
const themeAccessPath = path.join(root, 'src', 'utils', 'themePreviewAccess.ts');
const registerPath = path.join(root, 'docs', 'SECTION_UNIFICATION_REGISTER.md');
const violations = [];

const requiredFiles = [
  path.join(loginRoot, 'loginModel.ts'),
  path.join(loginRoot, 'loginModel.test.ts'),
  path.join(themeRoot, 'themePreviewModel.ts'),
  path.join(themeRoot, 'themePreviewModel.test.ts'),
  themeAccessPath,
];

function report(filePath, message) {
  violations.push(`${path.relative(root, filePath)}: ${message}`);
}

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function collectCodeFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCodeFiles(fullPath, acc);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name)) acc.push(fullPath);
  }
  return acc;
}

for (const requiredFile of requiredFiles) {
  if (!fs.existsSync(requiredFile)) report(requiredFile, 'required Login/Theme closure file is missing.');
}

const strictFiles = [
  ...collectCodeFiles(loginRoot),
  ...collectCodeFiles(themeRoot),
  themeAccessPath,
];

for (const filePath of strictFiles) {
  const source = read(filePath);
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any is not allowed in Login/Theme closure scope.' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in Login/Theme closure scope.' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in Login/Theme closure scope.' },
    { pattern: /as\s+never\b/, message: 'as never is not allowed in Login/Theme closure scope.' },
    { pattern: /as\s+unknown\b/, message: 'as unknown is not allowed in Login/Theme closure scope.' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in Login/Theme closure scope.' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in Login/Theme closure scope.' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in Login/Theme closure scope.' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) report(filePath, check.message);
  }
  if (/<table\b/.test(source)) report(filePath, 'raw table is not allowed in Login/Theme closure scope.');
}

const loginScreen = read(path.join(loginRoot, 'LoginScreen.tsx'));
if (!loginScreen.includes('./loginModel')) {
  report(path.join(loginRoot, 'LoginScreen.tsx'), 'LoginScreen must delegate identifier/session helpers to loginModel.');
}

const themeScreen = read(path.join(themeRoot, 'ThemeUILabTab.tsx'));
if (!themeScreen.includes('./themePreviewModel')) {
  report(path.join(themeRoot, 'ThemeUILabTab.tsx'), 'ThemeUILabTab must delegate lab model data to themePreviewModel.');
}

const register = read(registerPath);
if (!register.includes('## Login And Theme Preview') || !register.includes('check:login-theme-governance')) {
  report(registerPath, 'section unification register must document Login/Theme closure and governance.');
}

if (violations.length) {
  console.error('Login/Theme governance failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Login/Theme governance passed.');
