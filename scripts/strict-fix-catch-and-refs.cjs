/**
 * - Annotate catch clause variables as `any` when untyped (fixes strict + .message access).
 * - Replace `useRef(null)` with `useRef<any>(null)` so .current is not `never`.
 */
const path = require('path');
const { Project, SyntaxKind } = require('ts-morph');

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '..', 'tsconfig.strict.json'),
});

let catchAnnotated = 0;
let refReplacements = 0;

for (const sf of project.getSourceFiles()) {
  const fp = sf.getFilePath();
  if (fp.includes('node_modules')) continue;
  if (fp.endsWith('.d.ts')) continue;
  if (!fp.includes(`${path.sep}src${path.sep}`) && !fp.includes('/src/')) continue;

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CatchClause) return;
    const cc = node.asKindOrThrow(SyntaxKind.CatchClause);
    const decl = cc.getVariableDeclaration();
    if (!decl) return;
    if (decl.getTypeNode()) return;
    decl.setType('any');
    catchAnnotated += 1;
  });

  const text = sf.getFullText();
  if (text.includes('useRef(null)')) {
    const next = text.split('useRef(null)').join('useRef<any>(null)');
    if (next !== text) {
      sf.replaceWithText(next);
      refReplacements += (text.match(/useRef\(null\)/g) || []).length;
    }
  }
}

console.log(`Catch variables annotated: ${catchAnnotated}, useRef(null) -> useRef<any>(null): ${refReplacements}`);
project.saveSync();
console.log('Saved.');
