// Runs before every test file (via jest.config.js setupFiles).
// Polyfills any globals we rely on that might be missing in older Node envs.

if (typeof globalThis.structuredClone === 'undefined') {
	globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}
