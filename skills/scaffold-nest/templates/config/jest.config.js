/** @type {import('jest').Config} */
module.exports = {
	rootDir: '..',
	preset: 'ts-jest',
	testEnvironment: 'node',
	testMatch: ['<rootDir>/tests/specs/**/*.spec.ts'],
	globalSetup: '<rootDir>/tests/framework/globalSetup.js',
	setupFiles: ['<rootDir>/tests/framework/setupGlobals.js'],
	moduleFileExtensions: ['ts', 'js', 'json'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
	},
	transform: {
		'^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/config/tsconfig.json' }],
	},
	verbose: true,
};
