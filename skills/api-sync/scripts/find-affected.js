#!/usr/bin/env node
/**
 * Find projects that depend on one or more packages.
 *
 * Supports both single-package and monorepo workflows:
 * - Single package: pass --package @vendidit/shared
 * - Monorepo: pass --packages @vendidit/shared,@vendidit/auth (comma-separated)
 *             or pipe in the output of analyze-changes.js via --changes-file
 *
 * Scanning rules:
 * - If --root is the same as the project dir (monorepo root), only scan
 *   sub-packages within the monorepo for cross-package refs.
 * - If --root is a parent dir, scan sibling projects for external refs.
 * - If --external-root is given, also scan that directory for external
 *   projects (but only for references, not for changes).
 *
 * Usage:
 *   node find-affected.js --root /path --package @vendidit/shared [--skip proj1]
 *   node find-affected.js --root /path --changes-file /tmp/changes.json
 *
 * Output: JSON with affected projects.
 */
const path = require('path');
const fs = require('fs');
const { parseArgs, findProjects, dependsOn, findImports, gitInfo, readPackageJson, readGoModule, loadManifest } = require('./utils');

const { flags } = parseArgs();

if (flags.help) {
	console.log(`
Usage: node find-affected.js --root <dir> --package <name> [options]

Options:
  --root <dir>            Root directory to scan for dependent projects
  --package <name>        Single package name to search for
  --packages <names>      Comma-separated package names (monorepo mode)
  --changes-file <path>   JSON file from analyze-changes.js (extracts package names)
  --clients <paths>       Comma-separated explicit project paths to mark as
                          affected (always included, no auto-discovery needed).
                          Useful when the source isn't a package (e.g. an API
                          server) but downstream SDKs still need to be checked.
  --manifest <file>       YAML/JSON manifest of clients. If omitted, looks for
                          .claude/contracts/sdk-clients.{yaml,yml,json} in
                          --self or cwd. Manifest entries are always included.
  --skip <names>          Comma-separated project folder names to skip
  --self <dir>            Current project dir(s) to exclude (comma-separated)
  --external-root <dir>   Additional directory to scan for external dependents
  --help                  Show this help
`);
	process.exit(0);
}

const root = path.resolve(flags.root || process.cwd());
const skip = (flags.skip || '').split(',').filter(Boolean).map(s => s.trim());
const selfDirs = (flags.self || '').split(',').filter(Boolean).map(s => path.resolve(s.trim()));
const externalRoot = flags['external-root'] ? path.resolve(flags['external-root']) : null;
const explicitClients = (flags.clients || '').split(',').filter(Boolean).map(s => s.trim());
const manifest = loadManifest(selfDirs[0] || process.cwd(), flags.manifest);

// Gather package names to search for
let packageNames = [];
if (flags['changes-file']) {
	try {
		const changes = JSON.parse(fs.readFileSync(flags['changes-file'], 'utf8'));
		packageNames = (changes.packages || []).map(p => p.name).filter(Boolean);
	} catch (e) {
		console.error('Error reading changes file:', e.message);
		process.exit(1);
	}
} else if (flags.packages) {
	packageNames = flags.packages.split(',').map(s => s.trim()).filter(Boolean);
} else if (flags.package) {
	packageNames = [flags.package];
} else {
	const pkg = readPackageJson(root);
	if (pkg?.name) packageNames = [pkg.name];
	const goMod = readGoModule(root);
	if (goMod) packageNames.push(goMod);
}

// If we have a manifest or explicit clients, packageNames isn't strictly required —
// the manifest itself can declare per-client packages to check.
const haveExplicitTargets = explicitClients.length > 0 || (manifest && manifest.clients && manifest.clients.length > 0);
if (packageNames.length === 0 && !haveExplicitTargets) {
	console.error('Error: no package names found and no --clients/--manifest provided.');
	console.error('Use --package, --packages, --changes-file, --clients, or --manifest.');
	process.exit(1);
}

// Find all candidate projects
let allProjects = findProjects(root);

// Also scan external root if provided
if (externalRoot && externalRoot !== root) {
	const externalProjects = findProjects(externalRoot);
	allProjects = allProjects.concat(externalProjects);
}

// Inject explicit clients (CLI flag) and manifest entries as candidates so the
// loop below inspects them too. Their `forced` flag means they're always emitted
// in the affected list, even with zero detected references.
const forcedClients = new Map();
/** Walk up from `dir` looking for a go.mod; returns the module path or null. */
function parentGoModule(dir) {
	let cur = path.resolve(dir);
	while (cur && cur !== path.dirname(cur)) {
		const mod = readGoModule(cur);
		if (mod) return mod;
		cur = path.dirname(cur);
	}
	return null;
}

function addForced(absDir, source, declaredPackages, declaredKind, notes) {
	if (!fs.existsSync(absDir)) return;
	const key = path.resolve(absDir);
	if (forcedClients.has(key)) return;
	const pkg = readPackageJson(absDir);
	const goModule = readGoModule(absDir) || parentGoModule(absDir);
	const hasGoFiles = goModule && fs.existsSync(absDir) && fs.readdirSync(absDir).some(f => f.endsWith('.go'));
	const kind = pkg ? 'npm' : (goModule || hasGoFiles || declaredKind === 'go' ? 'go' : (declaredKind || 'unknown'));
	forcedClients.set(key, {
		dir: absDir,
		name: (pkg && pkg.name) || goModule || path.basename(absDir),
		pkg: pkg || null,
		goModule,
		kind,
		_forced: true,
		_source: source,
		_declaredPackages: declaredPackages || [],
		_declaredKind: declaredKind || null,
		_notes: notes || null,
	});
}

for (const c of explicitClients) {
	const abs = path.isAbsolute(c) ? c : path.resolve(process.cwd(), c);
	addForced(abs, 'explicit', [], null, null);
}
if (manifest) {
	const manifestDir = path.dirname(manifest.manifestPath);
	const projectRoot = selfDirs[0] || path.resolve(manifestDir, '../..');
	for (const c of manifest.clients) {
		if (!c.path) continue;
		const abs = path.isAbsolute(c.path) ? c.path : path.resolve(projectRoot, c.path);
		const pkgs = Array.isArray(c.packages) ? c.packages : (c.packages ? [c.packages] : []);
		addForced(abs, `manifest:${manifest.manifestPath}`, pkgs, c.kind || null, c.notes || null);
	}
}

// Deduplicate by resolved dir, then merge in forced clients
const seen = new Set();
allProjects = allProjects.filter(p => {
	const key = path.resolve(p.dir);
	if (seen.has(key)) return false;
	seen.add(key);
	return true;
});
for (const [key, fc] of forcedClients) {
	if (!seen.has(key)) {
		allProjects.push(fc);
		seen.add(key);
	} else {
		const existing = allProjects.find(p => path.resolve(p.dir) === key);
		if (existing) Object.assign(existing, {
			_forced: true, _source: fc._source,
			_declaredPackages: fc._declaredPackages,
			_declaredKind: fc._declaredKind, _notes: fc._notes,
		});
	}
}

const affected = [];

for (const project of allProjects) {
	const resolvedDir = path.resolve(project.dir);

	// Skip self directories (exact match only — in-repo sub-packages below the
	// source dir can legitimately be clients and must not be filtered out).
	if (selfDirs.some(s => resolvedDir === s)) continue;

	// Skip by folder name or package name
	const folderName = path.basename(project.dir);
	if (skip.includes(folderName) || skip.includes(project.name)) continue;

	// Check each package name (auto-discovered + per-client declared)
	const matchedPackages = [];
	let totalImports = 0;
	const allImportFiles = [];

	const packagesToCheck = Array.from(new Set([
		...packageNames,
		...((project._declaredPackages) || []),
	]));

	for (const pkgName of packagesToCheck) {
		const depRef = project.pkg ? dependsOn(project.pkg, pkgName) : null;
		const importFiles = findImports(project.dir, pkgName);

		let hasPathAlias = false;
		try {
			const tsconfigPaths = [
				path.join(project.dir, 'tsconfig.json'),
				path.join(project.dir, 'config/tsconfig.json'),
			];
			for (const tc of tsconfigPaths) {
				if (fs.existsSync(tc) && fs.readFileSync(tc, 'utf8').includes(pkgName)) {
					hasPathAlias = true;
					break;
				}
			}
		} catch {}

		if (depRef || importFiles.length > 0 || hasPathAlias) {
			matchedPackages.push({
				package: pkgName,
				dependencyRef: depRef,
				hasPathAlias,
				importCount: importFiles.length,
			});
			totalImports += importFiles.length;
			allImportFiles.push(...importFiles);
		}
	}

	if (matchedPackages.length > 0 || project._forced) {
		const git = gitInfo(project.dir);
		affected.push({
			name: project.name,
			dir: project.dir,
			folderName,
			kind: project.kind || (project.pkg ? 'npm' : (project.goModule ? 'go' : 'unknown')),
			branch: git.branch,
			remote: git.remote,
			dirty: git.dirty,
			packages: matchedPackages,
			totalImports,
			importFiles: [...new Set(allImportFiles)].slice(0, 30),
			source: project._source || 'discovered',
			declaredKind: project._declaredKind || null,
			notes: project._notes || null,
		});
	}
}

console.log(JSON.stringify({
	root,
	externalRoot: externalRoot || null,
	packageNames,
	manifestPath: manifest ? manifest.manifestPath : null,
	explicitClients,
	skipped: skip,
	totalScanned: allProjects.length,
	affectedCount: affected.length,
	affected,
}, null, 2));
