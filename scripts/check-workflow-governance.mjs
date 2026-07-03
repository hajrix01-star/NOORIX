import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowsDir = path.join(root, '.github', 'workflows');
const failures = [];

const blockedPatterns = [
  {
    pattern: /actions\/checkout@v4\b/g,
    message: 'actions/checkout@v4 is blocked; use actions/checkout@v7.',
  },
  {
    pattern: /actions\/setup-node@v4\b/g,
    message: 'actions/setup-node@v4 is blocked; use actions/setup-node@v6.',
  },
  {
    pattern: /node-version:\s*['"]?20['"]?\b/g,
    message: 'Node 20 is blocked in workflows; use Node 22.',
  },
];

for (const name of readdirSync(workflowsDir).sort()) {
  if (!/\.(ya?ml)$/.test(name)) continue;
  const relativePath = `.github/workflows/${name}`;
  const text = readFileSync(path.join(workflowsDir, name), 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const { pattern, message } of blockedPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        failures.push(`${relativePath}:${index + 1} - ${message}`);
      }
    }
  });
}

if (failures.length > 0) {
  console.error('Workflow governance check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Workflow governance check passed.');
