#!/usr/bin/env node
/**
 * Analyze export changes between git refs.
 *
 * Supports both single-package projects and monorepos. In monorepo mode,
 * it detects which sub-packages had changes and analyzes each separately.
 *
 * Usage:
 *   node analyze-changes.js --project /path/to/project [--since HEAD~1]
 *
 * Output: JSON with { packages: [...] }, each entry containing changed
 * exports, renames, and signature changes for one package.
 */
const { run, parseArgs, readPackageJson } = require('./utils');
const path = require('path');
const fs = require('fs');

const { flags } = parseArgs();

if (flags.help) {
	console.log(`
Usage: node analyze-changes.js --project <dir> [--since <ref>]

Detects whether <dir> is a monorepo or single package. For monorepos,
analyzes each sub-package that has changes.

Options:
  --project <dir>   Project or monorepo root directory (required)
  --since <ref>     Git ref to diff against (default: HEAD~1)
  --help            Show this help
`);
	process.exit(0);
}

const projectDir = path.resolve(flags.project || process.cwd());
const since = flags.since || 'HEAD~1';

// 1. Get all changed files
const diffFiles = run(`git diff --name-only ${since} HEAD`, { cwd: projectDir });
if (!diffFiles) {
	console.log(JSON.stringify({ packages: [], message: 'No changes detected' }));
	process.exit(0);
}

const changedFiles = diffFiles.split('\n').filter(Boolean);

// 2. Detect monorepo: check for workspace config or multiple package.json files
const isMonorepo = detectMonorepo(projectDir);

// 3. Group changed files by package
const packageGroups = groupByPackage(projectDir, changedFiles, isMonorepo);

// 4. Analyze each package
const packages = [];
for (const [pkgDir, files] of Object.entries(packageGroups)) {
	const pkg = readPackageJson(pkgDir);
	if (!pkg) continue;

	const sourceFiles = files.filter(f =>
		(f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.go')) &&
		!f.includes('node_modules') && !f.includes('dist/') &&
		!f.includes('.test.') && !f.includes('.spec.')
	);

	if (sourceFiles.length === 0) continue;

	const analysis = analyzePackageChanges(projectDir, pkgDir, pkg, sourceFiles, since);
	if (analysis.changes.length > 0 || analysis.renames.length > 0 || analysis.packageChanges) {
		packages.push(analysis);
	}
}

console.log(JSON.stringify({
	projectDir,
	isMonorepo,
	since,
	packages,
	summary: {
		packagesChanged: packages.length,
		totalExportsChanged: packages.reduce((n, p) => n + p.changes.length + p.renames.length, 0),
	}
}, null, 2));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectMonorepo(dir) {
	// Check for common monorepo indicators
	const rootPkg = readPackageJson(dir);
	if (rootPkg?.workspaces) return true;

	const indicators = ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json'];
	for (const f of indicators) {
		if (fs.existsSync(path.join(dir, f))) return true;
	}

	// Check if there are multiple package.json files in subdirectories
	let pkgCount = 0;
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const e of entries) {
			if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist') {
				if (fs.existsSync(path.join(dir, e.name, 'package.json'))) pkgCount++;
				if (pkgCount >= 2) return true;
			}
		}
	} catch {}
	return false;
}

function groupByPackage(rootDir, files, isMonorepo) {
	if (!isMonorepo) {
		// Single package: all files belong to root
		return { [rootDir]: files };
	}

	// Monorepo: group files by their nearest package.json
	const groups = {};
	for (const file of files) {
		const absFile = path.join(rootDir, file);
		const pkgDir = findNearestPackage(absFile, rootDir);
		if (!groups[pkgDir]) groups[pkgDir] = [];
		groups[pkgDir].push(file);
	}
	return groups;
}

function findNearestPackage(filePath, rootDir) {
	let dir = path.dirname(filePath);
	while (dir !== rootDir && dir !== path.dirname(dir)) {
		if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
		dir = path.dirname(dir);
	}
	return rootDir;
}

function analyzePackageChanges(gitRoot, pkgDir, pkg, sourceFiles, since) {
	const exportChanges = [];
	const renames = [];

	for (const file of sourceFiles) {
		const fullPath = path.join(gitRoot, file);
		if (!fs.existsSync(fullPath)) continue;

		const diff = run(`git diff ${since} HEAD -- "${file}"`, { cwd: gitRoot });
		if (!diff) continue;

		const lines = diff.split('\n');
		const removedExports = [];
		const addedExports = [];

		for (const line of lines) {
			// TypeScript/JS exports
			const exportMatch = line.match(/^[-+]\s*export\s+(?:(?:function|const|let|var|class|enum|interface|type)\s+)?(\w+)/);
			if (exportMatch) {
				const name = exportMatch[1];
				if (name === 'default') continue;
				if (line.startsWith('-') && !line.startsWith('---')) removedExports.push(name);
				if (line.startsWith('+') && !line.startsWith('+++')) addedExports.push(name);
			}

			// Re-exports: export { X } or export { X as Y }
			const reExportMatch = line.match(/^[-+]\s*export\s*\{([^}]+)\}/);
			if (reExportMatch) {
				const names = reExportMatch[1].split(',').map(s => {
					const parts = s.trim().split(/\s+as\s+/);
					return parts[parts.length - 1].trim();
				}).filter(Boolean);
				if (line.startsWith('-') && !line.startsWith('---')) removedExports.push(...names);
				if (line.startsWith('+') && !line.startsWith('+++')) addedExports.push(...names);
			}

			// Go exports
			const goMatch = line.match(/^[-+]\s*(?:func|type|const|var)\s+\(?([A-Z]\w*)/);
			if (goMatch) {
				const name = goMatch[1];
				if (line.startsWith('-') && !line.startsWith('---')) removedExports.push(name);
				if (line.startsWith('+') && !line.startsWith('+++')) addedExports.push(name);
			}
		}

		// Detect renames
		for (const removed of removedExports) {
			if (!addedExports.includes(removed)) {
				const match = addedExports.find(a =>
					a.toLowerCase() === removed.toLowerCase() ||
					a.includes(removed) || removed.includes(a)
				);
				if (match) {
					renames.push({ from: removed, to: match, file });
				} else {
					exportChanges.push({ type: 'removed', name: removed, file });
				}
			}
		}
		for (const added of addedExports) {
			if (!removedExports.includes(added) && !renames.find(r => r.to === added)) {
				exportChanges.push({ type: 'added', name: added, file });
			}
		}

		// Detect signature changes
		for (const name of removedExports) {
			if (addedExports.includes(name)) {
				const oldLine = lines.find(l => l.startsWith('-') && l.includes(name) && !l.startsWith('---'));
				const newLine = lines.find(l => l.startsWith('+') && l.includes(name) && !l.startsWith('+++'));
				if (oldLine && newLine && oldLine.slice(1) !== newLine.slice(1)) {
					exportChanges.push({
						type: 'signature_changed', name, file,
						old: oldLine.slice(1).trim(),
						new: newLine.slice(1).trim(),
					});
				}
			}
		}
	}

	// Package.json changes
	let packageChanges = null;
	const pkgJsonRelative = path.relative(gitRoot, path.join(pkgDir, 'package.json'));
	if (sourceFiles.some(f => f === pkgJsonRelative || f.endsWith('package.json'))) {
		const oldPkg = run(`git show ${since}:${pkgJsonRelative} 2>/dev/null`, { cwd: gitRoot });
		if (oldPkg) {
			try {
				const old = JSON.parse(oldPkg);
				if (old.name !== pkg.name) packageChanges = { type: 'name_changed', from: old.name, to: pkg.name };
				else if (old.version !== pkg.version) packageChanges = { type: 'version_changed', from: old.version, to: pkg.version };
			} catch {}
		}
	}

	return {
		name: pkg.name || path.basename(pkgDir),
		dir: pkgDir,
		relativeDir: path.relative(gitRoot, pkgDir) || '.',
		changedFiles: sourceFiles,
		changes: exportChanges,
		renames,
		packageChanges,
		summary: {
			filesChanged: sourceFiles.length,
			exportsAdded: exportChanges.filter(c => c.type === 'added').length,
			exportsRemoved: exportChanges.filter(c => c.type === 'removed').length,
			exportsRenamed: renames.length,
			signatureChanges: exportChanges.filter(c => c.type === 'signature_changed').length,
		},
	};
}
