const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.(test|spec).(ts|tsx)'],
  modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/dist/', '<rootDir>/build/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^lucide-react(.*)$': '<rootDir>/__mocks__/lucide-react.tsx',
  },
};

module.exports = createJestConfig(customJestConfig);
