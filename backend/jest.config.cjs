/**
 * Jest for Nest (TS + decorators) — backend `*.integration.spec.ts` only.
 * Run: npm test  |  With DB: FINANCIAL_INTEGRATION_TEST=1 npm test
 * `jest.pretest.cjs` loads `backend/.env` and short DB connect timeouts/retries so a missing Postgres fails in seconds (not minutes).
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.integration.spec.ts'],
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
