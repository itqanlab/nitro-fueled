export default {
  moduleFileExtensions: ['ts', 'js'],
  testEnvironment: 'node',
  testRegex: '.spec.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/scripts/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@nestjs/(.*)$': '<rootDir>/../../node_modules/@nestjs/$1',
    '^rxjs/(.*)$': '<rootDir>/../../node_modules/rxjs/dist/cjs/$1',
    '^socket\\.io(-client)?$': '<rootDir>/../../node_modules/socket.io/dist',
  },
  testTimeout: 10000,
};
