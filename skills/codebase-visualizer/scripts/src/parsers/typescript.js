const { Project, SyntaxKind, ts } = require('ts-morph');
const path = require('path');
const fs = require('fs');

/**
 * Resolve --scope to an actual directory path.
 * Tries: exact, ./scope, ./src/scope, ./packages/scope
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
 * Get visibility modifier string
 */
function getVisibility(node) {
  if (node.hasModifier && node.hasModifier(SyntaxKind.PrivateKeyword)) return 'private';
  if (node.hasModifier && node.hasModifier(SyntaxKind.ProtectedKeyword)) return 'protected';
  return 'public';
}

/**
 * Extract method info from a method declaration
 */
function extractMethod(method) {
  const params = method.getParameters().map(p => {
    const typeNode = p.getTypeNode();
    return {
      name: p.getName(),
      type: typeNode ? typeNode.getText() : 'any',
    };
  });
  const returnTypeNode = method.getReturnTypeNode();
  return {
    name: method.getName(),
    visibility: getVisibility(method),
    params,
    returnType: returnTypeNode ? returnTypeNode.getText() : 'void',
    isAsync: method.isAsync ? method.isAsync() : false,
    isStatic: method.isStatic ? method.isStatic() : false,
  };
}

/**
 * Extract property info
 */
function extractProperty(prop) {
  const typeNode = prop.getTypeNode();
  return {
    name: prop.getName(),
    type: typeNode ? typeNode.getText() : 'any',
    visibility: getVisibility(prop),
    isReadonly: prop.isReadonly ? prop.isReadonly() : false,
    isStatic: prop.isStatic ? prop.isStatic() : false,
  };
}

/**
 * Extract constructor-injected dependencies
 */
function extractConstructorDeps(cls) {
  const deps = [];
  const ctors = cls.getConstructors();
  if (ctors.length === 0) return deps;
  const ctor = ctors[0];
  for (const param of ctor.getParameters()) {
    const typeNode = param.getTypeNode();
    if (typeNode) {
      deps.push(typeNode.getText());
    }
  }
  return deps;
}

/**
 * Parse all TypeScript/JavaScript source files in the given directory.
 */
function parse(directory, options = {}) {
  const { scope, excludePatterns = [] } = options;
  const resolvedDir = resolveScope(directory, scope);

  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Directory not found: ${resolvedDir}`);
  }

  const project = new Project({
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    skipAddingFilesFromTsConfig: true,
  });

  const defaultExcludes = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**'];
  const allExcludes = [...defaultExcludes, ...excludePatterns];

  project.addSourceFilesAtPaths([
    path.join(resolvedDir, '**/*.{ts,tsx,js,jsx}'),
  ]);

  const symbols = [];
  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    const relativePath = path.relative(resolvedDir, filePath);

    if (allExcludes.some(pattern => {
      const simple = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
      return relativePath.includes(simple.replace(/\//g, path.sep).replace(/^\//, ''));
    })) {
      continue;
    }

    // Extract classes
    for (const cls of sourceFile.getClasses()) {
      const name = cls.getName();
      if (!name) continue;

      const extendsClause = cls.getExtends();
      const implementsClauses = cls.getImplements();

      symbols.push({
        kind: 'class',
        name,
        filePath: relativePath,
        methods: cls.getMethods().map(extractMethod),
        properties: cls.getProperties().map(extractProperty),
        extends: extendsClause ? extendsClause.getText() : null,
        implements: implementsClauses.map(i => i.getText()),
        decorators: cls.getDecorators().map(d => d.getName()),
        constructorDeps: extractConstructorDeps(cls),
      });
    }

    // Extract interfaces
    for (const iface of sourceFile.getInterfaces()) {
      const name = iface.getName();
      if (!name) continue;

      const extendsClauses = iface.getExtends();

      symbols.push({
        kind: 'interface',
        name,
        filePath: relativePath,
        methods: iface.getMethods().map(m => ({
          name: m.getName(),
          visibility: 'public',
          params: m.getParameters().map(p => ({
            name: p.getName(),
            type: p.getTypeNode() ? p.getTypeNode().getText() : 'any',
          })),
          returnType: m.getReturnTypeNode() ? m.getReturnTypeNode().getText() : 'void',
          isAsync: false,
          isStatic: false,
        })),
        properties: iface.getProperties().map(p => ({
          name: p.getName(),
          type: p.getTypeNode() ? p.getTypeNode().getText() : 'any',
          visibility: 'public',
          isReadonly: p.isReadonly(),
          isStatic: false,
        })),
        extends: extendsClauses.map(e => e.getText()),
        implements: [],
      });
    }

    // Extract type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      const name = typeAlias.getName();
      if (!name) continue;

      symbols.push({
        kind: 'type',
        name,
        filePath: relativePath,
        typeText: typeAlias.getTypeNode() ? typeAlias.getTypeNode().getText() : '',
        methods: [],
        properties: [],
        extends: null,
        implements: [],
      });
    }

    // Extract enums
    for (const enumDecl of sourceFile.getEnums()) {
      const name = enumDecl.getName();
      if (!name) continue;

      symbols.push({
        kind: 'enum',
        name,
        filePath: relativePath,
        members: enumDecl.getMembers().map(m => m.getName()),
        methods: [],
        properties: [],
        extends: null,
        implements: [],
      });
    }

    // Extract imports for reference tracking
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const isExternal = !moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/');

      const namedImports = importDecl.getNamedImports().map(ni => ni.getName());
      const defaultImport = importDecl.getDefaultImport();

      if (namedImports.length > 0 || defaultImport) {
        symbols.push({
          kind: 'import',
          filePath: relativePath,
          names: defaultImport ? [defaultImport.getText(), ...namedImports] : namedImports,
          source: moduleSpecifier,
          isExternal,
          resolvedPath: isExternal ? null : resolveImportPath(resolvedDir, filePath, moduleSpecifier),
        });
      }
    }
  }

  return { symbols, baseDir: resolvedDir };
}

/**
 * Resolve a relative import to an absolute file path
 */
function resolveImportPath(baseDir, fromFile, moduleSpecifier) {
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, moduleSpecifier);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) {
      return path.relative(baseDir, candidate);
    }
  }
  return path.relative(baseDir, resolved);
}

module.exports = { parse, resolveScope };
