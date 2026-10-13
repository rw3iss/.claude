// Runs once before the whole test session (via jest.config.js globalSetup).
// Cleans up any stale @vendidit/test-tools staging artifacts from previous runs
// so the reporter doesn't surface mixed results.

const fs = require('fs');
const path = require('path');

module.exports = async function () {
	const stagingFile = path.resolve(__dirname, '..', 'results', '.report-staging.json');
	try {
		if (fs.existsSync(stagingFile)) fs.unlinkSync(stagingFile);
	} catch {
		// ignore — a missing file is the desired end state
	}
};
