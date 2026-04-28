/**
 * Jest for Nest (TS + decorators): `*.integration.spec.ts` (DB) + `*.util.spec.ts` (pure unit) + `*.facade.spec.ts` (facade parity) + `*.service.spec.ts` (service unit) + `*.controller.spec.ts` (controller unit).
 * Run: npm test  |  With DB: FINANCIAL_INTEGRATION_TEST=1 npm test
 * `jest.pretest.cjs` loads `backend/.env` and short DB connect timeouts/retries so a missing Postgres fails in seconds (not minutes).
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/*.integration.spec.ts',
    '**/*.util.spec.ts',
    '**/*.facade.spec.ts',
    '**/*.service.spec.ts',
    '**/*.controller.spec.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
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
