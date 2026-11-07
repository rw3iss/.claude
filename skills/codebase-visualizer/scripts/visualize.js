#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Check for node_modules
const scriptDir = __dirname;
if (!fs.existsSync(path.join(scriptDir, 'node_modules'))) {
  console.log('Dependencies not installed. Running npm install...');
  execSync('npm install', { cwd: scriptDir, stdio: 'inherit' });
}

const { parse } = require('./src/parser');
const { buildGraph } = require('./src/graph');
const { layoutGraph } = require('./src/layout');
const { render } = require('./src/renderer');

// --- Argument parsing ---
function parseArgs(argv) {
  const args = {
    directory: '.',
    scope: null,
    lang: null,
    methods: false,
    properties: false,
    output: null,
    exclude: [],
    open: false,
  };

  let i = 2; // skip node and script path
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--scope' && argv[i + 1]) {
      args.scope = argv[++i];
    } else if (arg === '--lang' && argv[i + 1]) {
      args.lang = argv[++i];
    } else if (arg === '--methods') {
      args.methods = true;
    } else if (arg === '--properties') {
      args.properties = true;
    } else if (arg === '--output' && argv[i + 1]) {
      args.output = argv[++i];
    } else if (arg === '--exclude' && argv[i + 1]) {
      args.exclude.push(argv[++i]);
    } else if (arg === '--open') {
      args.open = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      args.directory = arg;
    }
    i++;
  }

  return args;
}

function printHelp() {
  console.log(`
Usage: node visualize.js [directory] [options]

Generate a PNG class-relationship diagram from source code.
Supports: TypeScript/JavaScript, Python (auto-detected).

Arguments:
  directory           Source directory to scan (default: current directory)

Options:
  --lang <language>   Force language (typescript, python). Auto-detected if omitted.
  --scope <path>      Scope to a subdirectory (tries ./path, ./src/path, ./packages/path)
  --methods           Show method signatures in class/interface boxes
  --properties        Show properties in class/interface boxes
  --output <file>     Output PNG file path (default: class-diagram.png in current dir)
  --exclude <pattern> Glob pattern to exclude (can be repeated)
  --open              Open the diagram in the default viewer after generating
  -h, --help          Show this help message

Examples:
  node visualize.js ~/project/src
  node visualize.js ~/project --scope models --methods --properties
  node visualize.js ~/python-project/src --lang python --properties
  node visualize.js . --output diagram.png --exclude "**/*.test.*"
`);
}

// --- Main ---
async function main() {
  const args = parseArgs(process.argv);
  const directory = path.resolve(args.directory);

  if (!fs.existsSync(directory)) {
    console.error(`Error: Directory not found: ${directory}`);
    process.exit(1);
  }

  console.log(`Scanning: ${directory}${args.scope ? ` (scope: ${args.scope})` : ''}`);

  // 1. Parse
  const { symbols, baseDir } = parse(directory, {
    lang: args.lang,
    scope: args.scope,
    excludePatterns: args.exclude,
  });

  const declarations = symbols.filter(s => s.kind !== 'import');
  console.log(`Found ${declarations.length} symbols (${symbols.filter(s => s.kind === 'class').length} classes, ${symbols.filter(s => s.kind === 'interface').length} interfaces, ${symbols.filter(s => s.kind === 'type').length} types, ${symbols.filter(s => s.kind === 'enum').length} enums)`);

  if (declarations.length === 0) {
    console.log('No classes, interfaces, types, or enums found. Nothing to diagram.');
    process.exit(0);
  }

  // 2. Build graph
  const graphData = buildGraph(symbols);
  console.log(`Graph: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);

  // 3. Layout
  const layoutData = layoutGraph(graphData, {
    showMethods: args.methods,
    showProperties: args.properties,
  });

  // 4. Render
  const dirName = path.basename(baseDir);
  const scopeLabel = args.scope ? ` / ${args.scope}` : '';
  const title = `${dirName}${scopeLabel} — Class Diagram`;

  const pngBuffer = render(layoutData, {
    showMethods: args.methods,
    showProperties: args.properties,
    title,
  });

  // 5. Write output
  const outputPath = args.output
    ? path.resolve(args.output)
    : path.resolve(process.cwd(), 'class-diagram.png');

  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`Diagram written to: ${outputPath}`);

  // 6. Open in viewer if --open flag is set
  if (args.open) {
    try {
      const platform = process.platform;
      if (platform === 'darwin') {
        execSync(`open "${outputPath}"`, { stdio: 'ignore' });
      } else if (platform === 'linux') {
        execSync(`xdg-open "${outputPath}" 2>/dev/null || true`, { stdio: 'ignore' });
      } else if (platform === 'win32') {
        execSync(`start "" "${outputPath}"`, { stdio: 'ignore' });
      }
    } catch {
      // Viewer not available, that's fine
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
