const path = require('path');
const fs = require('fs');

/**
 * Python AST-like parser using regex-based analysis.
 *
 * Extracts: classes, dataclasses, Pydantic models, Enums, type aliases,
 * Protocol classes (→ interface), and import relationships.
 */

// ── Scope resolution ─────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Walk a directory tree and return all .py files.
 */
function walkPythonFiles(dir, excludePatterns) {
  const results = [];
  const defaultExcludes = [
    'node_modules', '__pycache__', '.git', 'dist', 'build',
    '.venv', 'venv', '.tox', '.mypy_cache', '.pytest_cache',
    '.ruff_cache', 'migrations', 'alembic',
  ];

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (defaultExcludes.includes(entry.name)) continue;
        if (excludePatterns.some(p => fullPath.includes(p))) continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.py')) {
        if (entry.name.startsWith('__') && entry.name !== '__init__.py') continue;
        if (excludePatterns.some(p => fullPath.includes(p))) continue;
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Determine indentation level of a line (number of leading spaces).
 */
function indentLevel(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Parse a type annotation string, stripping Optional[], list[], etc. to find
 * referenced class names.
 */
function extractTypeReferences(typeStr) {
  if (!typeStr) return [];
  // Remove quotes (forward references)
  typeStr = typeStr.replace(/["']/g, '');
  // Find capitalized identifiers that look like class references
  const refs = [];
  const pattern = /\b([A-Z][A-Za-z0-9_]*)\b/g;
  let m;
  while ((m = pattern.exec(typeStr)) !== null) {
    const name = m[1];
    // Skip common built-in types
    if (['Any', 'None', 'Optional', 'Union', 'List', 'Dict', 'Set', 'Tuple',
         'Sequence', 'Mapping', 'Callable', 'Awaitable', 'Coroutine',
         'Type', 'ClassVar', 'Final', 'Literal', 'Annotated',
         'True', 'False', 'Self', 'Never', 'NoReturn',
         'AsyncGenerator', 'Generator', 'Iterator', 'AsyncIterator',
         'Iterable', 'AsyncIterable',
         'String', 'Integer', 'Float', 'Boolean', 'UUID',
         'JSON', 'JSONB', 'Text', 'Column', 'Field',
        ].includes(name)) continue;
    refs.push(name);
  }
  return [...new Set(refs)];
}

// ── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a single Python file and extract symbols.
 */
function parseFile(filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const symbols = [];

  // ── Pass 1: Extract imports ──────────────────────────────────────────────
  const importedNames = new Map(); // name → module

  for (const line of lines) {
    const trimmed = line.trim();

    // from X import Y, Z
    const fromImport = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
    if (fromImport) {
      const module = fromImport[1];
      const isExternal = !module.startsWith('.');
      const names = fromImport[2]
        .replace(/\(.*\)/, s => s) // handle parenthesized imports inline
        .split(',')
        .map(n => n.trim().split(/\s+as\s+/)[0].trim())
        .filter(n => n && !n.startsWith('#') && n !== '\\');

      for (const name of names) {
        importedNames.set(name, module);
      }

      if (names.length > 0) {
        symbols.push({
          kind: 'import',
          filePath: relativePath,
          names,
          source: module,
          isExternal,
          resolvedPath: isExternal ? null : resolvePythonImport(path.dirname(filePath), module),
        });
      }
      continue;
    }

    // import X, import X as Y
    const directImport = trimmed.match(/^import\s+([\w.]+)(?:\s+as\s+\w+)?/);
    if (directImport) {
      const module = directImport[1];
      importedNames.set(module.split('.').pop(), module);
    }
  }

  // ── Pass 2: Extract classes ──────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip non-class lines at module level
    const classMatch = trimmed.match(/^class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:/);
    if (!classMatch) continue;

    // Only top-level classes (indent 0)
    if (indentLevel(line) !== 0) continue;

    const className = classMatch[1];
    const basesStr = classMatch[2] || '';
    const bases = basesStr
      .split(',')
      .map(b => b.trim())
      .filter(b => b && !b.includes('=')); // filter keyword args like metaclass=

    // Determine the kind based on bases
    let kind = 'class';
    const extendsNames = [];
    const implementsNames = [];
    const decorators = [];
    let isEnum = false;
    let isDataclass = false;
    let isPydantic = false;
    let isProtocol = false;

    // Check decorators above the class
    for (let d = i - 1; d >= 0; d--) {
      const dl = lines[d].trim();
      if (dl.startsWith('@')) {
        const decName = dl.replace('@', '').split('(')[0].trim();
        decorators.push(decName);
        if (decName === 'dataclass' || decName === 'dataclasses.dataclass') isDataclass = true;
      } else if (dl === '' || dl.startsWith('#')) {
        continue;
      } else {
        break;
      }
    }

    for (const base of bases) {
      const baseName = base.split('[')[0].trim(); // Strip generics like Generic[T]
      if (['Enum', 'IntEnum', 'StrEnum', 'Flag', 'IntFlag'].includes(baseName)) {
        isEnum = true;
      } else if (baseName === 'Protocol') {
        isProtocol = true;
      } else if (['BaseModel', 'BaseSettings'].includes(baseName)) {
        isPydantic = true;
      } else if (['ABC', 'ABCMeta', 'object'].includes(baseName)) {
        // Skip abstract base / object
      } else if (['Generic', 'TypedDict'].includes(baseName)) {
        // Skip generic markers
      } else {
        extendsNames.push(baseName);
      }
    }

    if (isProtocol) kind = 'interface';
    if (isEnum) kind = 'enum';

    // Parse class body
    const methods = [];
    const properties = [];
    const enumMembers = [];
    const bodyIndent = findBodyIndent(lines, i);

    for (let j = i + 1; j < lines.length; j++) {
      const bodyLine = lines[j];
      const bodyTrimmed = bodyLine.trim();

      // Stop at next top-level definition
      if (bodyTrimmed && indentLevel(bodyLine) === 0 && !bodyTrimmed.startsWith('#') && !bodyTrimmed.startsWith('"""') && !bodyTrimmed.startsWith("'''")) {
        break;
      }

      // Skip blank lines, comments, docstrings
      if (!bodyTrimmed || bodyTrimmed.startsWith('#')) continue;
      if (indentLevel(bodyLine) !== bodyIndent) continue;

      // Enum members: NAME = value
      if (isEnum) {
        const enumMemberMatch = bodyTrimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)/);
        if (enumMemberMatch) {
          enumMembers.push(enumMemberMatch[1]);
          continue;
        }
      }

      // Method definitions
      const methodMatch = bodyTrimmed.match(/^(async\s+)?def\s+(\w+)\s*\(([^)]*(?:\([^)]*\))*[^)]*)\)\s*(?:->\s*(.+?))?\s*:/);
      if (methodMatch) {
        const isAsync = !!methodMatch[1];
        const methodName = methodMatch[2];
        const paramsStr = methodMatch[3];
        const returnType = methodMatch[4] || 'None';

        // Determine visibility
        let visibility = 'public';
        if (methodName.startsWith('__') && !methodName.endsWith('__')) {
          visibility = 'private';
        } else if (methodName.startsWith('_')) {
          visibility = 'protected';
        }

        // Check for static/class method decorators
        let isStatic = false;
        for (let d = j - 1; d > i; d--) {
          const dl = lines[d].trim();
          if (dl === '@staticmethod') { isStatic = true; break; }
          if (dl === '@classmethod') { isStatic = true; break; }
          if (!dl.startsWith('@') && dl !== '' && !dl.startsWith('#')) break;
        }

        // Parse parameters (skip self/cls)
        const params = parseParams(paramsStr);

        methods.push({
          name: methodName,
          visibility,
          params,
          returnType: returnType.trim(),
          isAsync,
          isStatic,
        });
        continue;
      }

      // Class-level attributes / properties (for dataclasses, Pydantic, etc.)
      // Pattern: name: type = value  OR  name: type
      const attrMatch = bodyTrimmed.match(/^(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/);
      if (attrMatch) {
        const attrName = attrMatch[1];
        const attrType = attrMatch[2].trim();

        // Skip if it's just a docstring variable or a constant
        if (attrName === attrName.toUpperCase() && attrName.length > 1) continue;

        properties.push({
          name: attrName,
          type: attrType,
          visibility: attrName.startsWith('_') ? 'protected' : 'public',
          isReadonly: false,
          isStatic: false,
        });
        continue;
      }
    }

    const symbol = {
      kind,
      name: className,
      filePath: relativePath,
      methods,
      properties,
      extends: extendsNames.length > 0 ? (extendsNames.length === 1 ? extendsNames[0] : extendsNames) : null,
      implements: implementsNames,
      decorators,
      constructorDeps: extractConstructorDeps(methods),
    };

    if (isEnum) {
      symbol.members = enumMembers;
    }

    symbols.push(symbol);
  }

  // ── Pass 3: Extract module-level type aliases ────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (indentLevel(line) !== 0) continue;

    // TypeAlias = ... (PEP 613 style)
    const typeAliasMatch = trimmed.match(/^([A-Z]\w+)\s*(?::\s*TypeAlias\s*)?=\s*(.+)/);
    if (typeAliasMatch) {
      const name = typeAliasMatch[1];
      const typeText = typeAliasMatch[2].trim();

      // Must look like a type (Union, Optional, Literal, or capitalized reference)
      if (isLikelyTypeAlias(name, typeText, symbols)) {
        symbols.push({
          kind: 'type',
          name,
          filePath: relativePath,
          typeText,
          methods: [],
          properties: [],
          extends: null,
          implements: [],
        });
      }
    }
  }

  return symbols;
}

/**
 * Heuristic: does this assignment look like a type alias?
 */
function isLikelyTypeAlias(name, value, existingSymbols) {
  // Already found as a class? Skip.
  if (existingSymbols.some(s => s.name === name && s.kind !== 'import')) return false;

  // Explicit TypeAlias annotation
  if (value.includes('TypeAlias')) return true;

  // Common type alias patterns
  if (/^(Union|Optional|Literal|Type|Callable|Sequence|Mapping|Dict|List|Set|Tuple)\[/.test(value)) return true;
  if (value.includes(' | ')) return true; // PEP 604 union
  if (/^[A-Z]\w+\[/.test(value)) return true; // Generic[...]

  return false;
}

/**
 * Find the indentation level of the class body (first non-blank, non-comment
 * line after the class declaration).
 */
function findBodyIndent(lines, classLineIndex) {
  for (let j = classLineIndex + 1; j < lines.length; j++) {
    const line = lines[j];
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip docstrings
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      // Find end of docstring
      const quote = trimmed.slice(0, 3);
      if (trimmed.length > 3 && trimmed.endsWith(quote)) continue;
      for (let k = j + 1; k < lines.length; k++) {
        if (lines[k].trim().endsWith(quote)) { j = k; break; }
      }
      continue;
    }
    return indentLevel(line);
  }
  return 4; // default
}

/**
 * Parse a Python parameter string, skipping `self` and `cls`.
 */
function parseParams(paramsStr) {
  if (!paramsStr.trim()) return [];

  const params = [];
  // Simple split — handles most cases (not nested parens in defaults)
  const parts = splitParams(paramsStr);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === 'self' || trimmed === 'cls') continue;
    if (trimmed.startsWith('*') || trimmed.startsWith('**')) continue;

    // name: type = default
    const match = trimmed.match(/^(\w+)\s*(?::\s*([^=]+?))?(?:\s*=\s*(.+))?$/);
    if (match) {
      params.push({
        name: match[1],
        type: match[2] ? match[2].trim() : 'Any',
      });
    }
  }

  return params;
}

/**
 * Split parameters respecting bracket nesting.
 */
function splitParams(str) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const ch of str) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * Extract constructor dependencies from __init__ method params.
 */
function extractConstructorDeps(methods) {
  const init = methods.find(m => m.name === '__init__');
  if (!init) return [];

  return init.params
    .map(p => p.type)
    .filter(t => t && t !== 'Any' && /^[A-Z]/.test(t));
}

/**
 * Resolve a Python dotted import path to a relative file path.
 */
function resolvePythonImport(baseDir, module) {
  // Relative imports: dots → parent dirs
  const dotMatch = module.match(/^(\.+)(.*)/);
  if (dotMatch) {
    const dots = dotMatch[1].length;
    const rest = dotMatch[2];
    let dir = baseDir;
    for (let i = 1; i < dots; i++) dir = path.dirname(dir);
    const parts = rest ? rest.split('.') : [];
    return path.join(dir, ...parts) + '.py';
  }

  // Absolute imports — just convert dots to path
  const parts = module.split('.');
  return parts.join('/') + '.py';
}

// ── Public API ───────────────────────────────────────────────────────────────

function parse(directory, options = {}) {
  const { scope, excludePatterns = [] } = options;
  const resolvedDir = resolveScope(directory, scope);

  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Directory not found: ${resolvedDir}`);
  }

  const pyFiles = walkPythonFiles(resolvedDir, excludePatterns);
  const symbols = [];

  for (const filePath of pyFiles) {
    const relativePath = path.relative(resolvedDir, filePath);
    try {
      const fileSymbols = parseFile(filePath, relativePath);
      symbols.push(...fileSymbols);
    } catch (err) {
      // Skip files that fail to parse
      console.warn(`Warning: Failed to parse ${relativePath}: ${err.message}`);
    }
  }

  return { symbols, baseDir: resolvedDir };
}

module.exports = { parse, resolveScope };
