/**
 * تدقيق سطح HTTP — يعدّ ملفات الـ controllers ومسارات @Get/@Post/…
 * تشغيل: node scripts/audit-http-surface.mjs
 * (لا يتصل بقاعدة البيانات — قراءة ملفات فقط.)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === 'dist') continue;
      walk(p, acc);
    } else if (name.isFile() && name.name.endsWith('.controller.ts')) acc.push(p);
  }
  return acc;
}

const methodRe = /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*(?:['`]([^)'`]+)['`])?/g;
const guardRe = /@UseGuards|APP_GUARD|ThrottlerGuard|JwtAuthGuard|RolesGuard|CompanyAccessGuard/;

const controllers = walk(srcDir);
let routeCount = 0;
let withGuardHint = 0;

for (const file of controllers) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  methodRe.lastIndex = 0;
  while ((m = methodRe.exec(text)) !== null) routeCount += 1;
  if (guardRe.test(text)) withGuardHint += 1;
}

const prismaModels = (() => {
  const schema = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  if (!fs.existsSync(schema)) return 0;
  const t = fs.readFileSync(schema, 'utf8');
  return (t.match(/^model\s+\w+/gm) || []).length;
})();

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  controllerFiles: controllers.length,
  httpMethodDecoratorsApprox: routeCount,
  controllerFilesWithGuardKeywords: withGuardHint,
  prismaModelCount: prismaModels,
  noteAr:
    'الأرقام تُولَّد من المستودع — لا تُستخدم أرقاماً ثابتة من تقارير قديمة. RLS: انظر prisma/rls_setup.sql.',
}, null, 2));
