/**
 * Jest for Nest (TS + decorators): `*.integration.spec.ts` (DB) + `*.util.spec.ts` (pure unit) + `*.rules.spec.ts` (pure insight rules) + `*.module.spec.ts` (Nest module wiring) + `*.facade.spec.ts` (facade parity) + `*.service.spec.ts` (service unit) + `*.controller.spec.ts` (controller unit) + `*.handler.spec.ts` (chat handlers).
 * Run: npm test  |  With DB: FINANCIAL_INTEGRATION_TEST=1 npm test
 * `jest.pretest.cjs` loads `backend/.env` and short DB connect timeouts/retries so a missing Postgres fails in seconds (not minutes).
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/*.integration.spec.ts',
    '**/*.util.spec.ts',
    '**/*.rules.spec.ts',
    '**/*.module.spec.ts',
    '**/*.facade.spec.ts',
    '**/*.service.spec.ts',
    '**/*.controller.spec.ts',
    '**/*.handler.spec.ts',
  ],
  testTimeout: 120_000,
  setupFiles: ['<rootDir>/jest.pretest.cjs'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
      },
    ],
  },
};
