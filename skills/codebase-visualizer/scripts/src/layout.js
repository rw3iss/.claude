const dagre = require('dagre');
const path = require('path');

const FONT_SIZE = 13;
const HEADER_HEIGHT = 40;
const LINE_HEIGHT = 18;
const PADDING_X = 16;
const MIN_WIDTH = 180;
const SECTION_DIVIDER = 8;
const CHAR_WIDTH = 7.5;

// Threshold: above this many nodes, switch to grouped row layout
const WRAP_THRESHOLD = 8;

// Grouped layout constants
const INNER_GAP = 24;       // gap between nodes within a folder group
const GROUP_GAP = 50;        // gap between folder groups
const ROW_GAP = 60;          // gap between diagram rows
const MAX_GROUP_COLS = 4;    // max nodes per row within a folder group

/**
 * Calculate the dimensions of a node based on its content.
 */
function calculateNodeSize(node, options = {}) {
  const { showMethods = false, showProperties = false } = options;

  const headerText = `<<${node.kind}>> ${node.name}`;
  const fileText = node.filePath;
  let headerWidth = Math.max(headerText.length, fileText.length) * CHAR_WIDTH + PADDING_X * 2;

  let height = HEADER_HEIGHT;
  let maxLineWidth = headerWidth;

  let propCount = 0;
  if (showProperties && node.properties && node.properties.length > 0) {
    height += SECTION_DIVIDER;
    for (const prop of node.properties) {
      const vis = prop.visibility === 'private' ? '-' : prop.visibility === 'protected' ? '#' : '+';
      const line = `${vis} ${prop.name}: ${prop.type}`;
      maxLineWidth = Math.max(maxLineWidth, line.length * CHAR_WIDTH + PADDING_X * 2);
      height += LINE_HEIGHT;
      propCount++;
    }
  }

  let methodCount = 0;
  if (showMethods && node.methods && node.methods.length > 0) {
    height += SECTION_DIVIDER;
    for (const method of node.methods) {
      const vis = method.visibility === 'private' ? '-' : method.visibility === 'protected' ? '#' : '+';
      const params = method.params.map(p => `${p.name}: ${p.type}`).join(', ');
      const line = `${vis} ${method.name}(${params}): ${method.returnType}`;
      maxLineWidth = Math.max(maxLineWidth, line.length * CHAR_WIDTH + PADDING_X * 2);
      height += LINE_HEIGHT;
      methodCount++;
    }
  }

  if (node.kind === 'enum' && node.members && node.members.length > 0) {
    height += SECTION_DIVIDER;
    for (const member of node.members) {
      maxLineWidth = Math.max(maxLineWidth, member.length * CHAR_WIDTH + PADDING_X * 2);
      height += LINE_HEIGHT;
    }
  }

  if (node.kind === 'type' && node.typeText) {
    height += SECTION_DIVIDER;
    const truncated = node.typeText.length > 50 ? node.typeText.slice(0, 47) + '...' : node.typeText;
    maxLineWidth = Math.max(maxLineWidth, truncated.length * CHAR_WIDTH + PADDING_X * 2);
    height += LINE_HEIGHT;
  }

  height += 10; // bottom padding

  const width = Math.max(MIN_WIDTH, maxLineWidth);
  return { width, height, propCount, methodCount };
}

// ─── Dagre layout (used for small graphs ≤ WRAP_THRESHOLD) ───────────────────

function dagreLayout(graphData, options) {
  const { showMethods = false, showProperties = false } = options;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeSizes = new Map();
  for (const node of graphData.nodes) {
    const size = calculateNodeSize(node, { showMethods, showProperties });
    nodeSizes.set(node.id, size);
    g.setNode(node.id, { width: size.width, height: size.height });
  }

  for (const edge of graphData.edges) {
    const weight = (edge.type === 'extends' || edge.type === 'implements') ? 3 : 1;
    g.setEdge(edge.from, edge.to, { weight, type: edge.type });
  }

  dagre.layout(g);

  const positionedNodes = graphData.nodes.map(node => {
    const dagreNode = g.node(node.id);
    const size = nodeSizes.get(node.id);
    return {
      ...node,
      x: dagreNode.x - size.width / 2,
      y: dagreNode.y - size.height / 2,
      width: size.width,
      height: size.height,
      propCount: size.propCount,
      methodCount: size.methodCount,
    };
  });

  const positionedEdges = graphData.edges.map(edge => {
    const dagreEdge = g.edge(edge.from, edge.to);
    return {
      ...edge,
      points: dagreEdge ? dagreEdge.points : [],
    };
  });

  const graphInfo = g.graph();

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    width: graphInfo.width || 800,
    height: graphInfo.height || 600,
  };
}

// ─── Grouped row layout (used for large graphs > WRAP_THRESHOLD) ─────────────

/**
 * Compute the point on a node's border where a line from its center to
 * (targetX, targetY) exits the rectangle.
 */
function getEdgePoint(node, targetX, targetY) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;

  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return { x: cx, y: cy };

  const hw = node.width / 2;
  const hh = node.height / 2;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Pure horizontal / vertical
  if (absDy < 0.1) return { x: cx + (dx > 0 ? hw : -hw), y: cy };
  if (absDx < 0.1) return { x: cx, y: cy + (dy > 0 ? hh : -hh) };

  // Determine which rectangle edge the line crosses first
  if (absDx * hh > absDy * hw) {
    // Exits through left or right edge
    const t = hw / absDx;
    return { x: cx + (dx > 0 ? hw : -hw), y: cy + dy * t };
  } else {
    // Exits through top or bottom edge
    const t = hh / absDy;
    return { x: cx + dx * t, y: cy + (dy > 0 ? hh : -hh) };
  }
}

/**
 * Order folder groups so that folders with many cross-edges are adjacent.
 * Uses a greedy "most-connected next" heuristic.
 */
function greedyGroupOrder(folders, edgeWeights) {
  if (folders.length <= 1) return folders;

  // Total inter-group weight per folder
  const totalWeights = new Map();
  for (const folder of folders) {
    let total = 0;
    for (const [key, weight] of edgeWeights) {
      const parts = key.split('|');
      if (parts[0] === folder || parts[1] === folder) total += weight;
    }
    totalWeights.set(folder, total);
  }

  // Start with the most-connected folder
  const ordered = [];
  const remaining = new Set(folders);

  let first = folders[0];
  let maxW = -1;
  for (const f of folders) {
    if (totalWeights.get(f) > maxW) { maxW = totalWeights.get(f); first = f; }
  }
  ordered.push(first);
  remaining.delete(first);

  while (remaining.size > 0) {
    let best = null;
    let bestScore = -1;
    for (const candidate of remaining) {
      let score = 0;
      for (const placed of ordered) {
        const key = [candidate, placed].sort().join('|');
        score += edgeWeights.get(key) || 0;
      }
      // Tie-break by total weight so isolated groups still get a stable order
      score = score * 1000 + (totalWeights.get(candidate) || 0);
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    ordered.push(best);
    remaining.delete(best);
  }

  return ordered;
}

/**
 * Sort nodes within a folder group so that base classes / interfaces appear
 * first (left / top) and derived classes follow.
 */
function sortNodesInGroup(nodes, edges) {
  // Count outgoing extends/implements for each node (more = more derived)
  const outgoing = new Map();
  for (const n of nodes) outgoing.set(n.id, 0);
  for (const e of edges) {
    if ((e.type === 'extends' || e.type === 'implements') && outgoing.has(e.from)) {
      outgoing.set(e.from, outgoing.get(e.from) + 1);
    }
  }

  nodes.sort((a, b) => {
    const ao = outgoing.get(a.id) || 0;
    const bo = outgoing.get(b.id) || 0;
    if (ao !== bo) return ao - bo; // base classes (0 outgoing) first
    return a.name.localeCompare(b.name);
  });
}

/**
 * Lay out nodes in a grouped-row arrangement:
 *  1. Group nodes by parent folder
 *  2. Lay out each group as an internal grid (max MAX_GROUP_COLS wide)
 *  3. Order groups by inter-group affinity
 *  4. Pack groups into diagram rows, wrapping at a target width
 *  5. Center each row
 *  6. Route edges as straight lines between node borders
 */
function groupedLayout(graphData, options) {
  const { showMethods = false, showProperties = false } = options;

  // ── 1. Node sizes ──────────────────────────────────────────────────────────
  const nodeSizes = new Map();
  for (const node of graphData.nodes) {
    nodeSizes.set(node.id, calculateNodeSize(node, { showMethods, showProperties }));
  }

  // ── 2. Group by parent folder ──────────────────────────────────────────────
  const folderGroups = new Map();
  for (const node of graphData.nodes) {
    const folder = path.dirname(node.filePath) || '.';
    if (!folderGroups.has(folder)) folderGroups.set(folder, []);
    folderGroups.get(folder).push(node);
  }

  // ── 3. Inter-group edge weights for ordering ──────────────────────────────
  const nodeIdToFolder = new Map();
  for (const [folder, nodes] of folderGroups) {
    for (const n of nodes) nodeIdToFolder.set(n.id, folder);
  }

  const edgeWeights = new Map();
  for (const edge of graphData.edges) {
    const ff = nodeIdToFolder.get(edge.from);
    const ft = nodeIdToFolder.get(edge.to);
    if (!ff || !ft || ff === ft) continue;
    const key = [ff, ft].sort().join('|');
    edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
  }

  const orderedFolders = greedyGroupOrder([...folderGroups.keys()], edgeWeights);

  // ── 4. Internal layout per folder group ───────────────────────────────────
  const groupBoxes = [];

  for (const folder of orderedFolders) {
    const nodes = folderGroups.get(folder);
    sortNodesInGroup(nodes, graphData.edges);

    const cols = Math.min(MAX_GROUP_COLS, nodes.length);
    const rowCount = Math.ceil(nodes.length / cols);

    // Per-column width, per-row height
    const colWidths = new Array(cols).fill(0);
    const rowHeights = new Array(rowCount).fill(0);

    for (let i = 0; i < nodes.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const sz = nodeSizes.get(nodes[i].id);
      colWidths[c] = Math.max(colWidths[c], sz.width);
      rowHeights[r] = Math.max(rowHeights[r], sz.height);
    }

    // Compute local (x, y) for each node within the group
    const nodePositions = [];
    for (let i = 0; i < nodes.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const localX = colWidths.slice(0, c).reduce((s, w) => s + w + INNER_GAP, 0);
      const localY = rowHeights.slice(0, r).reduce((s, h) => s + h + INNER_GAP, 0);
      const sz = nodeSizes.get(nodes[i].id);
      nodePositions.push({ node: nodes[i], localX, localY, width: sz.width, height: sz.height, propCount: sz.propCount, methodCount: sz.methodCount });
    }

    const groupWidth  = colWidths.reduce((s, w) => s + w, 0) + Math.max(0, cols - 1) * INNER_GAP;
    const groupHeight = rowHeights.reduce((s, h) => s + h, 0) + Math.max(0, rowCount - 1) * INNER_GAP;

    groupBoxes.push({ folder, nodePositions, width: groupWidth, height: groupHeight });
  }

  // ── 5. Pack groups into diagram rows ──────────────────────────────────────
  // Target width: roughly square-ish output
  const totalArea = groupBoxes.reduce((s, g) => s + (g.width + GROUP_GAP) * (g.height + ROW_GAP), 0);
  const targetRowWidth = Math.max(
    1200,
    Math.sqrt(totalArea) * 1.4,
  );

  const diagramRows = [];
  let curRow = { groups: [], width: 0, height: 0 };

  for (const group of groupBoxes) {
    const addedWidth = (curRow.groups.length > 0 ? GROUP_GAP : 0) + group.width;
    if (curRow.groups.length > 0 && curRow.width + addedWidth > targetRowWidth) {
      diagramRows.push(curRow);
      curRow = { groups: [], width: 0, height: 0 };
    }
    curRow.width += (curRow.groups.length > 0 ? GROUP_GAP : 0) + group.width;
    curRow.height = Math.max(curRow.height, group.height);
    curRow.groups.push(group);
  }
  if (curRow.groups.length > 0) diagramRows.push(curRow);

  // ── 6. Center rows & compute final positions ─────────────────────────────
  const maxRowWidth = Math.max(...diagramRows.map(r => r.width));
  const positionedNodes = [];
  let yOffset = 0;

  for (const row of diagramRows) {
    const rowXOffset = (maxRowWidth - row.width) / 2;
    let xOffset = rowXOffset;

    for (const group of row.groups) {
      // Vertically center the group within the row
      const groupYOff = (row.height - group.height) / 2;

      for (const np of group.nodePositions) {
        positionedNodes.push({
          ...np.node,
          x: xOffset + np.localX,
          y: yOffset + groupYOff + np.localY,
          width: np.width,
          height: np.height,
          propCount: np.propCount,
          methodCount: np.methodCount,
        });
      }

      xOffset += group.width + GROUP_GAP;
    }

    yOffset += row.height + ROW_GAP;
  }

  // ── 7. Route edges ────────────────────────────────────────────────────────
  const nodeMap = new Map();
  for (const n of positionedNodes) nodeMap.set(n.id, n);

  const positionedEdges = graphData.edges.map(edge => {
    const fromNode = nodeMap.get(edge.from);
    const toNode   = nodeMap.get(edge.to);
    if (!fromNode || !toNode) return { ...edge, points: [] };

    const fromPt = getEdgePoint(fromNode, toNode.x + toNode.width / 2, toNode.y + toNode.height / 2);
    const toPt   = getEdgePoint(toNode, fromNode.x + fromNode.width / 2, fromNode.y + fromNode.height / 2);

    // For longer edges, add a midpoint to give the line a slight curve for
    // readability (avoids perfectly-overlapping straight lines).
    const dx = toPt.x - fromPt.x;
    const dy = toPt.y - fromPt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 400) {
      // Offset the midpoint perpendicular to the line
      const mx = (fromPt.x + toPt.x) / 2;
      const my = (fromPt.y + toPt.y) / 2;
      const nx = -dy / dist * 18; // perpendicular offset
      const ny =  dx / dist * 18;
      return { ...edge, points: [fromPt, { x: mx + nx, y: my + ny }, toPt] };
    }

    return { ...edge, points: [fromPt, toPt] };
  });

  // ── 8. Final dimensions ───────────────────────────────────────────────────
  let totalWidth = 0;
  let totalHeight = 0;
  for (const n of positionedNodes) {
    totalWidth  = Math.max(totalWidth,  n.x + n.width);
    totalHeight = Math.max(totalHeight, n.y + n.height);
  }

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    width: totalWidth,
    height: totalHeight,
  };
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Lay out the graph. Uses dagre for small graphs, grouped-row layout for
 * larger ones to avoid overly wide diagrams.
 */
function layoutGraph(graphData, options = {}) {
  if (graphData.nodes.length <= WRAP_THRESHOLD) {
    return dagreLayout(graphData, options);
  }
  return groupedLayout(graphData, options);
}

module.exports = { layoutGraph, calculateNodeSize };
