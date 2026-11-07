const { createCanvas } = require('canvas');
const fs = require('fs');

// Color scheme by kind
const COLORS = {
  class:     { bg: '#3b82f6', text: '#ffffff', lightBg: '#eff6ff', border: '#2563eb' },
  interface: { bg: '#22c55e', text: '#ffffff', lightBg: '#f0fdf4', border: '#16a34a' },
  type:      { bg: '#a855f7', text: '#ffffff', lightBg: '#faf5ff', border: '#9333ea' },
  enum:      { bg: '#f97316', text: '#ffffff', lightBg: '#fff7ed', border: '#ea580c' },
};

const FONT_SIZE = 12;
const SMALL_FONT_SIZE = 10;
const LINE_HEIGHT = 18;
const HEADER_HEIGHT = 40;
const PADDING_X = 10;
const SECTION_DIVIDER = 8;
const TITLE_HEIGHT = 50;
const LEGEND_HEIGHT = 50;
const CORNER_RADIUS = 6;
const EXTERNAL_OPACITY = 0.45;

/**
 * Draw a rounded rectangle path
 */
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Draw a single node as a UML-style box
 */
function drawNode(ctx, node, options = {}) {
  const { showMethods = false, showProperties = false } = options;
  const colors = COLORS[node.kind] || COLORS.class;
  const { x, y, width, height } = node;

  if (node.isExternal) ctx.globalAlpha = EXTERNAL_OPACITY;

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Body background
  roundedRect(ctx, x, y, width, height, CORNER_RADIUS);
  ctx.fillStyle = colors.lightBg;
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Header background
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + CORNER_RADIUS, y);
  ctx.lineTo(x + width - CORNER_RADIUS, y);
  ctx.arcTo(x + width, y, x + width, y + CORNER_RADIUS, CORNER_RADIUS);
  ctx.lineTo(x + width, y + HEADER_HEIGHT);
  ctx.lineTo(x, y + HEADER_HEIGHT);
  ctx.lineTo(x, y + CORNER_RADIUS);
  ctx.arcTo(x, y, x + CORNER_RADIUS, y, CORNER_RADIUS);
  ctx.closePath();
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.restore();

  // Kind badge + Name
  ctx.fillStyle = colors.text;
  ctx.font = `bold ${FONT_SIZE}px monospace`;
  const kindBadge = `\u00AB${node.kind}\u00BB`;
  ctx.fillText(kindBadge, x + PADDING_X, y + 16);
  ctx.font = `bold ${FONT_SIZE + 1}px monospace`;
  ctx.fillText(node.name, x + PADDING_X, y + 32);

  // File path (right-aligned, smaller)
  ctx.font = `${SMALL_FONT_SIZE}px monospace`;
  const fileText = node.filePath.length > 28 ? '...' + node.filePath.slice(-25) : node.filePath;
  const fileWidth = ctx.measureText(fileText).width;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(fileText, x + width - fileWidth - PADDING_X, y + 16);

  let currentY = y + HEADER_HEIGHT;

  // Properties section
  if (showProperties && node.properties && node.properties.length > 0) {
    currentY += SECTION_DIVIDER;
    // Divider line
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, currentY - 4);
    ctx.lineTo(x + width - 4, currentY - 4);
    ctx.stroke();

    ctx.font = `${FONT_SIZE}px monospace`;
    for (const prop of node.properties) {
      const vis = prop.visibility === 'private' ? '-' : prop.visibility === 'protected' ? '#' : '+';
      const staticMark = prop.isStatic ? ' \u{1D54A}' : '';
      const readonlyMark = prop.isReadonly ? ' \u{1D4E1}' : '';
      const line = `${vis} ${prop.name}: ${prop.type}${staticMark}${readonlyMark}`;
      const truncated = line.length > 35 ? line.slice(0, 32) + '...' : line;
      ctx.fillStyle = '#374151';
      ctx.fillText(truncated, x + PADDING_X, currentY + 12);
      currentY += LINE_HEIGHT;
    }
  }

  // Methods section
  if (showMethods && node.methods && node.methods.length > 0) {
    currentY += SECTION_DIVIDER;
    // Divider line
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, currentY - 4);
    ctx.lineTo(x + width - 4, currentY - 4);
    ctx.stroke();

    ctx.font = `${FONT_SIZE}px monospace`;
    for (const method of node.methods) {
      const vis = method.visibility === 'private' ? '-' : method.visibility === 'protected' ? '#' : '+';
      const params = method.params.map(p => `${p.name}`).join(', ');
      const asyncMark = method.isAsync ? ' async' : '';
      const line = `${vis} ${method.name}(${params})${asyncMark}`;
      const truncated = line.length > 35 ? line.slice(0, 32) + '...' : line;
      ctx.fillStyle = '#374151';
      ctx.fillText(truncated, x + PADDING_X, currentY + 12);
      currentY += LINE_HEIGHT;
    }
  }

  // Enum members
  if (node.kind === 'enum' && node.members && node.members.length > 0) {
    currentY += SECTION_DIVIDER;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, currentY - 4);
    ctx.lineTo(x + width - 4, currentY - 4);
    ctx.stroke();

    ctx.font = `${FONT_SIZE}px monospace`;
    for (const member of node.members) {
      ctx.fillStyle = '#374151';
      ctx.fillText(member, x + PADDING_X, currentY + 12);
      currentY += LINE_HEIGHT;
    }
  }

  // Type alias text
  if (node.kind === 'type' && node.typeText) {
    currentY += SECTION_DIVIDER;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, currentY - 4);
    ctx.lineTo(x + width - 4, currentY - 4);
    ctx.stroke();

    ctx.font = `${FONT_SIZE}px monospace`;
    const truncated = node.typeText.length > 40 ? node.typeText.slice(0, 37) + '...' : node.typeText;
    ctx.fillStyle = '#6b7280';
    ctx.fillText(truncated, x + PADDING_X, currentY + 12);
  }

  ctx.globalAlpha = 1.0;
}

/**
 * Draw UML-style arrowheads
 */
function drawArrowhead(ctx, fromX, fromY, toX, toY, type) {
  const headLen = 12;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.save();
  ctx.translate(toX, toY);
  ctx.rotate(angle);

  if (type === 'extends') {
    // Filled triangle
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-headLen, -headLen / 2.5);
    ctx.lineTo(-headLen, headLen / 2.5);
    ctx.closePath();
    ctx.fillStyle = '#2563eb';
    ctx.fill();
  } else if (type === 'implements') {
    // Hollow triangle
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-headLen, -headLen / 2.5);
    ctx.lineTo(-headLen, headLen / 2.5);
    ctx.closePath();
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else {
    // Simple arrow for references
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-headLen, -headLen / 3);
    ctx.moveTo(0, 0);
    ctx.lineTo(-headLen, headLen / 3);
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw an edge (line + arrowhead)
 */
function drawEdge(ctx, edge) {
  const { points, type } = edge;
  if (!points || points.length < 2) return;

  ctx.save();

  if (type === 'extends') {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
  } else if (type === 'implements') {
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
  } else {
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead at last segment
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  drawArrowhead(ctx, prev.x, prev.y, last.x, last.y, type);

  ctx.restore();
}

/**
 * Draw the title bar at the top
 */
function drawTitle(ctx, title, canvasWidth) {
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(title, 20, 30);

  // Subtitle with count
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px monospace';
}

/**
 * Draw the legend bar at the bottom
 */
function drawLegend(ctx, y, canvasWidth) {
  const items = [
    { label: 'Class', color: COLORS.class.bg },
    { label: 'Interface', color: COLORS.interface.bg },
    { label: 'Type', color: COLORS.type.bg },
    { label: 'Enum', color: COLORS.enum.bg },
  ];

  const edgeItems = [
    { label: 'extends', dash: [], color: '#2563eb' },
    { label: 'implements', dash: [6, 4], color: '#16a34a' },
    { label: 'references', dash: [3, 3], color: '#9ca3af' },
  ];

  // Background
  ctx.fillStyle = '#f9fafb';
  ctx.fillRect(0, y, canvasWidth, LEGEND_HEIGHT);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(canvasWidth, y);
  ctx.stroke();

  let xPos = 20;
  const midY = y + LEGEND_HEIGHT / 2;

  // Node type legend
  for (const item of items) {
    // Color swatch
    ctx.fillStyle = item.color;
    roundedRect(ctx, xPos, midY - 8, 16, 16, 3);
    ctx.fill();

    // Label
    ctx.fillStyle = '#374151';
    ctx.font = '12px monospace';
    ctx.fillText(item.label, xPos + 22, midY + 5);
    xPos += ctx.measureText(item.label).width + 45;
  }

  xPos += 20;

  // Edge type legend
  for (const item of edgeItems) {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(item.dash);
    ctx.beginPath();
    ctx.moveTo(xPos, midY);
    ctx.lineTo(xPos + 30, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#374151';
    ctx.font = '12px monospace';
    ctx.fillText(item.label, xPos + 36, midY + 5);
    xPos += ctx.measureText(item.label).width + 60;
  }
}

/**
 * Render the positioned graph to a PNG buffer.
 */
function render(layoutData, options = {}) {
  const { showMethods = false, showProperties = false, title = 'Class Diagram' } = options;

  const padding = 60;
  const canvasWidth = Math.max(800, layoutData.width + padding * 2);
  const canvasHeight = Math.max(400, layoutData.height + TITLE_HEIGHT + LEGEND_HEIGHT + padding * 2);

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Title
  const nodeCount = layoutData.nodes.filter(n => !n.isExternal).length;
  const edgeCount = layoutData.edges.length;
  drawTitle(ctx, title, canvasWidth);
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px monospace';
  ctx.fillText(`${nodeCount} symbols, ${edgeCount} relationships`, 20, 46);

  // Offset all content below title
  ctx.save();
  ctx.translate(padding, TITLE_HEIGHT + padding / 2);

  // Draw edges first (below nodes)
  for (const edge of layoutData.edges) {
    drawEdge(ctx, edge);
  }

  // Draw nodes
  for (const node of layoutData.nodes) {
    drawNode(ctx, node, { showMethods, showProperties });
  }

  ctx.restore();

  // Legend at bottom
  drawLegend(ctx, canvasHeight - LEGEND_HEIGHT, canvasWidth);

  return canvas.toBuffer('image/png');
}

module.exports = { render };
