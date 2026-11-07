const path = require('path');
const fs = require('fs');

/**
 * Language-aware parser dispatcher.
 *
 * Detects the primary language of a directory and delegates to the
 * appropriate language-specific parser. All parsers return the same
 * unified symbol format consumed by graph.js / layout.js / renderer.js.
 */

const PARSERS = {
  typescript: () => require('./typescript'),
  python: () => require('./python'),
};

// File extension → language mapping
const EXT_TO_LANG = {
  '.ts':  'typescript',
  '.tsx': 'typescript',
  '.js':  'typescript',
  '.jsx': 'typescript',
  '.py':  'python',
};

// Supported extensions per language (for detection counting)
const LANG_EXTENSIONS = {
  typescript: ['.ts', '.tsx', '.js', '.jsx'],
  python: ['.py'],
};

/**
 * Detect the dominant language in a directory by counting source files.
 * Returns the language key (e.g. 'typescript', 'python') or null.
 */
function detectLanguage(directory) {
  const counts = {};
  for (const lang of Object.keys(LANG_EXTENSIONS)) {
    counts[lang] = 0;
  }

  function walk(dir, depth) {
    if (depth > 6) return; // don't go too deep for detection
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' ||
          entry.name === '__pycache__' || entry.name === 'venv' ||
          entry.name === '.venv' || entry.name === 'dist' ||
          entry.name === 'build' || entry.name === 'migrations') continue;

      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const lang = EXT_TO_LANG[ext];
        if (lang) counts[lang]++;
      }
    }
  }

  walk(directory, 0);

  // Pick the language with the most files
  let best = null;
  let bestCount = 0;
  for (const [lang, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      best = lang;
    }
  }

  return best;
}

/**
 * Resolve --scope the same way individual parsers do.
 */
function resolveScope(baseDir, scope) {
  if (!scope) return baseDir;
  const candidates = [
    path.resolve(baseDir, scope),
    path.resolve(baseDir, 'src', scope),
    path.resolve(baseDir, 'packages', scope),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
  }
  return path.resolve(baseDir, scope);
}

/**
 * Parse a directory using the appropriate language parser.
 *
 * @param {string} directory - Root directory to scan
 * @param {object} options
 * @param {string} [options.lang] - Force language ('typescript', 'python')
 * @param {string} [options.scope] - Subdirectory scope
 * @param {string[]} [options.excludePatterns] - Glob patterns to exclude
 * @returns {{ symbols: Array, baseDir: string }}
 */
function parse(directory, options = {}) {
  const { lang: forcedLang, scope, excludePatterns = [] } = options;

  // Resolve scope first so language detection uses the scoped dir
  const resolvedDir = resolveScope(directory, scope);

  const lang = forcedLang || detectLanguage(resolvedDir);
  if (!lang) {
    throw new Error(
      `Could not detect language in ${resolvedDir}. ` +
      `Use --lang to specify (supported: ${Object.keys(PARSERS).join(', ')})`
    );
  }

  const loaderFn = PARSERS[lang];
  if (!loaderFn) {
    throw new Error(
      `Unsupported language: ${lang}. ` +
      `Supported: ${Object.keys(PARSERS).join(', ')}`
    );
  }

  console.log(`Detected language: ${lang}`);
  const parser = loaderFn();
  return parser.parse(directory, { scope, excludePatterns });
}

module.exports = { parse, resolveScope, detectLanguage, PARSERS };
