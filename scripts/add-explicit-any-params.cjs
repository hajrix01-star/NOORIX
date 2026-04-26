/**
 * Add explicit `any` to untyped parameters (TS7006 / TS7031 under strict).
 * Walks all function-like nodes including nested function declarations and methods.
 */
const path = require('path');
const { Project, SyntaxKind } = require('ts-morph');

const root = path.join(__dirname, '..');
const project = new Project({
  tsConfigFilePath: path.join(root, 'tsconfig.strict.json'),
});

let annotated = 0;

function annotateParams(fnLike) {
  for (const p of fnLike.getParameters()) {
    if (p.getTypeNode()) continue;
    if (p.isRestParameter()) {
      p.setType('any[]');
    } else {
      p.setType('any');
    }
    annotated += 1;
  }
}

let filesTouched = 0;

for (const sf of project.getSourceFiles()) {
  const fp = sf.getFilePath();
  if (fp.includes('node_modules')) continue;
  if (fp.endsWith('.d.ts')) continue;
  if (!fp.includes(`${path.sep}src${path.sep}`) && !fp.includes('/src/')) continue;

  const start = annotated;
  sf.forEachDescendant((node) => {
    switch (node.getKind()) {
      case SyntaxKind.FunctionDeclaration:
        annotateParams(node.asKindOrThrow(SyntaxKind.FunctionDeclaration));
        break;
      case SyntaxKind.FunctionExpression:
        annotateParams(node.asKindOrThrow(SyntaxKind.FunctionExpression));
        break;
      case SyntaxKind.ArrowFunction:
        annotateParams(node.asKindOrThrow(SyntaxKind.ArrowFunction));
        break;
      case SyntaxKind.MethodDeclaration:
        annotateParams(node.asKindOrThrow(SyntaxKind.MethodDeclaration));
        break;
      case SyntaxKind.Constructor:
        annotateParams(node.asKindOrThrow(SyntaxKind.Constructor));
        break;
      default:
        break;
    }
  });

  if (annotated > start) filesTouched += 1;
}

console.log(`Annotated ${annotated} parameters in ${filesTouched} files.`);
project.saveSync();
console.log('Saved.');
