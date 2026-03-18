// backend/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/src/tests/**/*.test.js',
    '!**/src/tests/integration.test.js',  // excluded by default
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/index.js',
    '!src/db/migrate.js',
    '!src/db/seed.js',
    '!src/db/hashPassword.js',
  ],
  coverageThresholds: {
    global: { branches: 55, functions: 65, lines: 65, statements: 65 },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 15000,
  clearMocks: true,
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/'],
};
