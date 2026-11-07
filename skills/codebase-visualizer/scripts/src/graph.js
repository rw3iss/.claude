const path = require('path');

/**
 * Build a relationship graph from parsed symbols.
 * Returns { nodes: GraphNode[], edges: GraphEdge[] }
 */
function buildGraph(symbols) {
  // Separate imports from other symbols
  const imports = symbols.filter(s => s.kind === 'import');
  const declarations = symbols.filter(s => s.kind !== 'import');

  // Build lookup maps
  const nameToSymbol = new Map();
  const fileToSymbols = new Map();

  for (const sym of declarations) {
    nameToSymbol.set(sym.name, sym);
    const key = sym.filePath;
    if (!fileToSymbols.has(key)) fileToSymbols.set(key, []);
    fileToSymbols.get(key).push(sym);
  }

  // Build import map: file -> { importedName -> sourceFile }
  const fileImports = new Map();
  for (const imp of imports) {
    if (imp.isExternal) continue;
    if (!fileImports.has(imp.filePath)) fileImports.set(imp.filePath, new Map());
    const map = fileImports.get(imp.filePath);
    for (const name of imp.names) {
      map.set(name, imp.resolvedPath);
    }
  }

  // Create nodes
  const nodes = [];
  const nodeIds = new Set();

  for (const sym of declarations) {
    const id = `${sym.filePath}#${sym.name}`;
    if (nodeIds.has(id)) continue;
    nodeIds.add(id);

    nodes.push({
      id,
      name: sym.name,
      kind: sym.kind,
      filePath: sym.filePath,
      methods: sym.methods || [],
      properties: sym.properties || [],
      members: sym.members || [],
      typeText: sym.typeText || '',
      isExternal: false,
    });
  }

  // Create edges
  const edges = [];
  const edgeSet = new Set();

  function addEdge(fromId, toId, type) {
    const key = `${fromId}->${toId}:${type}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ from: fromId, to: toId, type });
  }

  function findOrCreateNode(name) {
    // Try exact match
    const sym = nameToSymbol.get(name);
    if (sym) return `${sym.filePath}#${sym.name}`;

    // Strip generic parameters for lookup
    const baseName = name.replace(/<.*>/, '');
    const baseSym = nameToSymbol.get(baseName);
    if (baseSym) return `${baseSym.filePath}#${baseSym.name}`;

    // Create placeholder
    const placeholderId = `external#${baseName}`;
    if (!nodeIds.has(placeholderId)) {
      nodeIds.add(placeholderId);
      nodes.push({
        id: placeholderId,
        name: baseName,
        kind: 'class',
        filePath: '(external)',
        methods: [],
        properties: [],
        members: [],
        typeText: '',
        isExternal: true,
      });
    }
    return placeholderId;
  }

  for (const sym of declarations) {
    const fromId = `${sym.filePath}#${sym.name}`;

    // extends relationships
    if (sym.extends) {
      const extendsList = Array.isArray(sym.extends) ? sym.extends : [sym.extends];
      for (const ext of extendsList) {
        if (!ext) continue;
        const toId = findOrCreateNode(ext);
        addEdge(fromId, toId, 'extends');
      }
    }

    // implements relationships
    if (sym.implements && sym.implements.length > 0) {
      for (const impl of sym.implements) {
        const toId = findOrCreateNode(impl);
        addEdge(fromId, toId, 'implements');
      }
    }

    // Constructor dependency injection references
    if (sym.constructorDeps && sym.constructorDeps.length > 0) {
      for (const dep of sym.constructorDeps) {
        // Skip primitive types
        if (['string', 'number', 'boolean', 'any', 'void', 'undefined', 'null', 'object'].includes(dep.toLowerCase())) continue;
        const baseDep = dep.replace(/<.*>/, '');
        if (nameToSymbol.has(baseDep)) {
          const toId = findOrCreateNode(baseDep);
          addEdge(fromId, toId, 'references');
        }
      }
    }

    // Import-based reference edges
    const importsForFile = fileImports.get(sym.filePath);
    if (importsForFile) {
      for (const [importedName, sourcePath] of importsForFile) {
        // Check if this symbol actually references the import
        // (by checking method types, property types, extends, implements)
        const usesImport = symbolReferences(sym, importedName);
        if (usesImport) {
          const targetSym = findSymbolInFile(declarations, sourcePath, importedName);
          if (targetSym) {
            const toId = `${targetSym.filePath}#${targetSym.name}`;
            // Don't duplicate extends/implements edges
            const existingKey1 = `${fromId}->${toId}:extends`;
            const existingKey2 = `${fromId}->${toId}:implements`;
            if (!edgeSet.has(existingKey1) && !edgeSet.has(existingKey2)) {
              addEdge(fromId, toId, 'references');
            }
          }
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Check if a symbol references a given name in its type annotations
 */
function symbolReferences(sym, name) {
  // Check property types
  for (const prop of (sym.properties || [])) {
    if (prop.type && prop.type.includes(name)) return true;
  }
  // Check method params and return types
  for (const method of (sym.methods || [])) {
    if (method.returnType && method.returnType.includes(name)) return true;
    for (const param of (method.params || [])) {
      if (param.type && param.type.includes(name)) return true;
    }
  }
  // Check type text
  if (sym.typeText && sym.typeText.includes(name)) return true;
  return false;
}

/**
 * Find a symbol declared in a specific file
 */
function findSymbolInFile(declarations, filePath, name) {
  // Normalize path for comparison
  return declarations.find(s =>
    s.name === name && (
      s.filePath === filePath ||
      s.filePath.replace(/\.(ts|tsx|js|jsx)$/, '') === filePath.replace(/\.(ts|tsx|js|jsx)$/, '')
    )
  );
}

module.exports = { buildGraph };
