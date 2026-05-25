#!/usr/bin/env node
/**
 * Update package.json dependency references in affected projects.
 *
 * Usage:
 *   node update-refs.js --project <dir> --package-name <name> --remote-url <url> [--dry-run true]
 *
 * Ensures the dependency reference uses the remote GitHub URL for deployability.
 */
const fs = require('fs');
const path = require('path');
const { parseArgs, readPackageJson, dependsOn } = require('./utils');

const { flags } = parseArgs();

if (flags.help) {
	console.log(`
Usage: node update-refs.js --project <dir> --package-name <name> --remote-url <url> [--dry-run true]

Options:
  --project <dir>        Project directory to update
  --package-name <name>  Package name (e.g. @vendidit/shared)
  --remote-url <url>     Git remote URL (e.g. git@github.com:Org/repo.git)
  --subpath <path>       Monorepo subpath (e.g. packages/test-tools)
  --dry-run <bool>       If 'true', report without modifying
  --help                 Show this help
`);
	process.exit(0);
}

const projectDir = flags.project;
const packageName = flags['package-name'];
const remoteUrl = flags['remote-url'] || '';
const subpath = flags.subpath || '';
const dryRun = flags['dry-run'] === 'true';

if (!projectDir || !packageName) {
	console.error('Error: --project and --package-name are required');
	process.exit(1);
}

const pkgPath = path.join(projectDir, 'package.json');
const pkg = readPackageJson(projectDir);
if (!pkg) {
	console.log(JSON.stringify({ error: 'No package.json found', project: projectDir }));
	process.exit(0);
}

const result = {
	project: path.basename(projectDir),
	packageName,
	dryRun,
	changes: [],
};

// Build the ideal reference
let idealRef = '';
if (remoteUrl) {
	// Convert SSH to github: shorthand
	// git@github.com:Org/Repo.git → github:Org/Repo
	const ghMatch = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
	if (ghMatch) {
		idealRef = `github:${ghMatch[1]}`;
		if (subpath) idealRef += `#path:${subpath}`;
	} else {
		idealRef = remoteUrl;
	}
} else {
	// No remote — flag it
	result.changes.push({
		type: 'warning',
		message: `Package ${packageName} has no remote URL. Using existing reference.`,
	});
}

// Check each dependency section
for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
	if (!pkg[section] || !pkg[section][packageName]) continue;

	const current = pkg[section][packageName];

	// Skip if it's already using the remote reference
	if (idealRef && current === idealRef) {
		result.changes.push({ type: 'ok', section, current, message: 'Already up to date' });
		continue;
	}

	// Skip if current is a semver range (published to npm) — don't overwrite
	if (/^\d|^\^|^~|^>=/.test(current)) {
		result.changes.push({ type: 'skip', section, current, message: 'Published npm version, not overwriting' });
		continue;
	}

	if (idealRef) {
		result.changes.push({
			type: 'updated',
			section,
			from: current,
			to: idealRef,
		});

		if (!dryRun) {
			pkg[section][packageName] = idealRef;
		}
	}
}

// Also ensure pnpm onlyBuiltDependencies includes the package
if (pkg.pnpm?.onlyBuiltDependencies && !pkg.pnpm.onlyBuiltDependencies.includes(packageName)) {
	pkg.pnpm.onlyBuiltDependencies.push(packageName);
	result.changes.push({ type: 'pnpm', message: `Added ${packageName} to onlyBuiltDependencies` });
}

// Write back
if (!dryRun && result.changes.some(c => c.type === 'updated' || c.type === 'pnpm')) {
	fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

console.log(JSON.stringify(result, null, 2));
