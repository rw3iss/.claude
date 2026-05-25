#!/usr/bin/env node
/**
 * Shared utilities for api-sync scripts.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/** Run a shell command, return stdout trimmed. Returns '' on error. */
function run(cmd, opts = {}) {
	try {
		return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, ...opts }).trim();
	} catch {
		return '';
	}
}

/** Parse CLI args into { flags: {}, positional: [] } */
function parseArgs(argv = process.argv.slice(2)) {
	const flags = {};
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith('--')) {
			const key = argv[i].slice(2);
			if (key === 'help') { flags.help = true; continue; }
			const next = argv[i + 1];
			if (next && !next.startsWith('--')) {
				flags[key] = next;
				i++;
			} else {
				flags[key] = 'true';
			}
		} else {
			positional.push(argv[i]);
		}
	}
	return { flags, positional };
}

/** Find the package.json for a project directory. Returns parsed JSON or null. */
function readPackageJson(dir) {
	const p = path.join(dir, 'package.json');
	try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

/** Get git info for a directory */
function gitInfo(dir) {
	const branch = run('git branch --show-current', { cwd: dir });
	const remote = run('git remote get-url origin 2>/dev/null', { cwd: dir });
	const dirty = run('git status --porcelain', { cwd: dir }) !== '';
	return { branch, remote, dirty };
}

/** Read go.mod and return module path, or null. */
function readGoModule(dir) {
	const p = path.join(dir, 'go.mod');
	try {
		const content = fs.readFileSync(p, 'utf8');
		const m = content.match(/^module\s+(\S+)/m);
		return m ? m[1] : null;
	} catch { return null; }
}

/** Find all project directories under root that have package.json or go.mod. */
function findProjects(root, maxDepth = 4) {
	const projects = [];
	function walk(dir, depth) {
		if (depth > maxDepth) return;
		if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('/dist') || dir.includes('/vendor')) return;
		const pkg = readPackageJson(dir);
		const goModule = readGoModule(dir);
		if (pkg || goModule) {
			projects.push({
				dir,
				name: (pkg && pkg.name) || goModule || path.basename(dir),
				pkg: pkg || null,
				goModule: goModule || null,
				kind: pkg ? 'npm' : 'go',
			});
			// Workspace roots (npm `workspaces` field) should still recurse so we
			// can pick up sub-packages and nested go modules. Non-workspace roots stop.
			const isWorkspaceRoot = pkg && pkg.workspaces;
			if (depth > 0 && !isWorkspaceRoot) return;
		}
		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const e of entries) {
				if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'vendor') {
					walk(path.join(dir, e.name), depth + 1);
				}
			}
		} catch { /* permission error, skip */ }
	}
	walk(root, 0);
	return projects;
}

/** Check if a project depends on a given package name */
function dependsOn(pkg, packageName) {
	const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
	return packageName in deps ? deps[packageName] : null;
}

/** Search files in a directory for import/require of a package. Returns matching file paths.
 *  Searches both JS/TS imports and Go imports (when packageName looks like a Go module path).
 */
function findImports(dir, packageName) {
	const matches = new Set();

	// JS/TS: search src/ if present, otherwise the whole project (capped depth)
	const jsRoots = [path.join(dir, 'src'), dir];
	const escaped = packageName.replace(/[.*+?^${}()|[\]\\@/]/g, '\\$&');
	for (const root of jsRoots) {
		if (!fs.existsSync(root)) continue;
		const result = run(
			`grep -rl --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.mjs" ` +
			`-E "from .${escaped}|require\\(.${escaped}" "${root}" 2>/dev/null || true`
		);
		if (result) result.split('\n').filter(Boolean).forEach(f => matches.add(f));
		if (matches.size > 0) break; // prefer src/ hits
	}

	// Go: scan .go files for the package import
	if (packageName.includes('/') || packageName.includes('.')) {
		const goResult = run(
			`grep -rl --include="*.go" -F '"${packageName}' "${dir}" 2>/dev/null || true`
		);
		if (goResult) goResult.split('\n').filter(Boolean).forEach(f => matches.add(f));
	}

	return Array.from(matches);
}

/** Default shared root: parent of cwd, unless it's ~ or ~/Sites */
function defaultRoot(projectDir) {
	const parent = path.dirname(projectDir);
	const home = process.env.HOME || '';
	if (parent === home || parent === path.join(home, 'Sites')) {
		return projectDir; // Don't scan all of ~/Sites or ~/
	}
	return parent;
}

/** Load an SDK-clients manifest.
 *  Looks for `.claude/contracts/sdk-clients.{json,yaml,yml}` in the project
 *  (or an explicit path). Returns { manifestPath, source?, clients: [...] } or null.
 *
 *  JSON is parsed natively. YAML is only parsed if the consuming project has
 *  `js-yaml` resolvable (we try to require it lazily). If YAML support is
 *  unavailable, emit a hint to stderr and skip the file — JSON is always safe.
 */
function loadManifest(projectDir, explicitPath) {
	const candidates = explicitPath
		? [explicitPath]
		: [
			path.join(projectDir, '.claude', 'contracts', 'sdk-clients.json'),
			path.join(projectDir, '.claude', 'contracts', 'sdk-clients.yaml'),
			path.join(projectDir, '.claude', 'contracts', 'sdk-clients.yml'),
		];
	let yaml = null;
	for (const p of candidates) {
		try {
			const content = fs.readFileSync(p, 'utf8');
			let data;
			if (p.endsWith('.json')) {
				data = JSON.parse(content);
			} else {
				if (!yaml) {
					// Try to resolve js-yaml from a few likely locations (project cwd,
					// project node_modules, and the skill's own node_modules if present).
					const tryPaths = [
						path.join(projectDir, 'node_modules/js-yaml'),
						path.join(process.cwd(), 'node_modules/js-yaml'),
						'js-yaml',
					];
					for (const tp of tryPaths) {
						try { yaml = require(tp); break; } catch { /* continue */ }
					}
				}
				if (!yaml) {
					process.stderr.write(
						`api-sync: found ${p} but js-yaml is not installed. ` +
						`Convert the manifest to JSON or \`npm i js-yaml\` in the project.\n`
					);
					continue;
				}
				data = yaml.load(content);
			}
			if (data && Array.isArray(data.clients)) {
				return { manifestPath: p, ...data };
			}
		} catch { /* try next */ }
	}
	return null;
}

module.exports = {
	run, parseArgs, readPackageJson, readGoModule, gitInfo,
	findProjects, dependsOn, findImports, defaultRoot, loadManifest,
};
