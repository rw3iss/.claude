#!/usr/bin/env node
/**
 * Update import statements in affected projects to match renamed exports.
 *
 * Usage:
 *   node update-imports.js --project <dir> --changes <json-file> [--dry-run true]
 *
 * Input: changes.json from analyze-changes.js
 * Output: JSON summary of changes made.
 */
const fs = require('fs');
const path = require('path');
const { parseArgs, findImports } = require('./utils');

const { flags } = parseArgs();

if (flags.help) {
	console.log(`
Usage: node update-imports.js --project <dir> --changes <json-file> [--package <name>] [--dry-run true]

Options:
  --project <dir>      Project directory to update
  --changes <file>     Path to changes JSON (from analyze-changes.js)
  --package <name>     Package name to match in imports
  --dry-run <bool>     If 'true', report without modifying (default: false)
  --help               Show this help
`);
	process.exit(0);
}

const projectDir = flags.project;
const changesFile = flags.changes;
const packageName = flags.package || '';
const dryRun = flags['dry-run'] === 'true';

if (!projectDir || !changesFile) {
	console.error('Error: --project and --changes are required');
	process.exit(1);
}

const changes = JSON.parse(fs.readFileSync(changesFile, 'utf8'));
const renames = changes.renames || [];
const exportChanges = changes.changes || [];

// Build a rename map: oldName → newName
const renameMap = {};
for (const r of renames) {
	renameMap[r.from] = r.to;
}

// Find files that import from the package
const importFiles = packageName ? findImports(projectDir, packageName) : [];

const results = {
	project: path.basename(projectDir),
	dryRun,
	filesScanned: importFiles.length,
	filesModified: 0,
	renamesApplied: [],
	manualReview: [],
};

for (const filePath of importFiles) {
	let content;
	try { content = fs.readFileSync(filePath, 'utf8'); } catch { continue; }

	let modified = false;
	let newContent = content;

	// Apply renames
	for (const [oldName, newName] of Object.entries(renameMap)) {
		// Match in import destructuring: { oldName } or { oldName, ... } or { ..., oldName }
		const importRegex = new RegExp(
			`(import\\s*\\{[^}]*\\b)${escapeRegex(oldName)}(\\b[^}]*\\}\\s*from\\s*['"]${escapeRegex(packageName)})`,
			'g'
		);
		if (importRegex.test(newContent)) {
			newContent = newContent.replace(importRegex, `$1${newName}$2`);
			modified = true;
			results.renamesApplied.push({ file: filePath, from: oldName, to: newName });
		}

		// Also replace usage of the old name in the rest of the file (if it was imported)
		if (modified) {
			// Replace standalone word references (not inside strings or comments)
			const usageRegex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'g');
			newContent = newContent.replace(usageRegex, newName);
		}
	}

	// Flag files that need manual review (signature changes)
	for (const change of exportChanges) {
		if (change.type === 'signature_changed' && content.includes(change.name)) {
			results.manualReview.push({
				file: filePath,
				export: change.name,
				reason: 'Signature changed',
				old: change.old,
				new: change.new,
			});
		}
	}

	if (modified && !dryRun) {
		fs.writeFileSync(filePath, newContent, 'utf8');
		results.filesModified++;
	} else if (modified) {
		results.filesModified++;
	}
}

console.log(JSON.stringify(results, null, 2));

function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
