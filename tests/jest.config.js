module.exports = {
  rootDir: '../',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'backend/src/**/*.ts',
    '!backend/src/services/gcpService.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.json' }]
  }
};
