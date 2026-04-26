/**
 * Jest for Nest (TS + decorators) — used for backend integration tests only.
 * Run: npm test  |  With DB: FINANCIAL_INTEGRATION_TEST=1 npm test
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.integration.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 120_000,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
      },
    ],
  },
};
