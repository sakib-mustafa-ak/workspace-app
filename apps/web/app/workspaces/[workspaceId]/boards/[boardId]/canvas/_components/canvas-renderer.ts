import type { CanvasState, CanvasObject } from '../_context/canvas-state';

const imageCache = new Map<string, HTMLImageElement>();

let themeCache: { key: string; colors: { bg: string; grid: string; accent: string } } | null = null;

function themeColors(): { bg: string; grid: string; accent: string } {
  if (typeof window === 'undefined') {
    return { bg: '#020617', grid: 'rgba(148,163,184,0.15)', accent: '#4d96ff' };
  }
  const root = document.documentElement;
  const key = root.className;
  if (themeCache && themeCache.key === key) return themeCache.colors;
  const cs = getComputedStyle(root);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const colors = {
    bg: get('--color-surface-950', '#020617'),
    grid: get('--color-surface-700', '#334155'),
    accent: get('--color-primary-500', '#3b82f6'),
  };
  themeCache = { key, colors };
  return colors;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: CanvasState,
  onImageReady?: (dataUrl: string) => void,
) {
  const { width, height } = ctx.canvas;
  const colors = themeColors();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(state.pan.x, state.pan.y);
  ctx.scale(state.zoom, state.zoom);

  if (state.gridVisible) {
    drawGrid(ctx, state, colors.grid);
  }

  const sorted = [...state.objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const obj of sorted) {
    ctx.save();
    ctx.globalAlpha = obj.opacity;
    ctx.translate(obj.x, obj.y);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    renderObject(ctx, obj, onImageReady);
    ctx.restore();
  }

  drawSelectionOverlay(ctx, state, colors.accent);

  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, state: CanvasState, gridColor: string) {
  const gridSize = 40 * state.zoom;
  const { width, height } = ctx.canvas;

  ctx.strokeStyle = gridColor;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;

  const offsetX = ((state.pan.x % gridSize) + gridSize) % gridSize;
  const offsetY = ((state.pan.y % gridSize) + gridSize) % gridSize;

  for (let x = offsetX; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = offsetY; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function renderObject(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  onImageReady?: (dataUrl: string) => void,
) {
  switch (obj.type) {
    case 'rectangle':
      ctx.fillStyle = obj.fill;
      ctx.fillRect(0, 0, obj.width, obj.height);
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = obj.strokeWidth;
      ctx.strokeRect(0, 0, obj.width, obj.height);
      break;
    case 'ellipse':
      ctx.fillStyle = obj.fill;
      ctx.beginPath();
      ctx.ellipse(obj.width / 2, obj.height / 2, Math.abs(obj.width / 2), Math.abs(obj.height / 2), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = obj.strokeWidth;
      ctx.stroke();
      break;
    case 'line':
    case 'arrow':
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = obj.strokeWidth;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(obj.width, obj.height);
      ctx.stroke();
      if (obj.type === 'arrow') {
        const angle = Math.atan2(obj.height, obj.width);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(obj.width, obj.height);
        ctx.lineTo(obj.width - headLen * Math.cos(angle - 0.4), obj.height - headLen * Math.sin(angle - 0.4));
        ctx.moveTo(obj.width, obj.height);
        ctx.lineTo(obj.width - headLen * Math.cos(angle + 0.4), obj.height - headLen * Math.sin(angle + 0.4));
        ctx.stroke();
      }
      break;
    case 'path': {
      const pts = obj.points ?? [];
      if (pts.length === 0) break;
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = obj.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0]!.x, pts[0]!.y, Math.max(obj.strokeWidth / 2, 1), 0, Math.PI * 2);
        ctx.fillStyle = obj.stroke;
        ctx.fill();
      }
      break;
    }
    case 'star':
    case 'triangle':
    case 'diamond':
    case 'pentagon':
    case 'hexagon': {
      const pts = polygonPoints(obj);
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fillStyle = obj.fill;
      ctx.fill();
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = obj.strokeWidth;
      ctx.stroke();
      break;
    }
    case 'table': {
      const t = obj.table ?? { rows: 2, cols: 2, cells: [['', ''], ['', '']] };
      const rows = Math.max(t.rows, 1);
      const cols = Math.max(t.cols, 1);
      const cw = obj.width / cols;
      const ch = obj.height / rows;
      // Cells
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = obj.fill || '#ffffff';
          ctx.fillRect(c * cw, r * ch, cw, ch);
        }
      }
      // Grid lines
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let r = 0; r <= rows; r++) {
        ctx.moveTo(0, r * ch);
        ctx.lineTo(obj.width, r * ch);
      }
      for (let c = 0; c <= cols; c++) {
        ctx.moveTo(c * cw, 0);
        ctx.lineTo(c * cw, obj.height);
      }
      ctx.stroke();
      // Cell text
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textBaseline = 'middle';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = t.cells?.[r]?.[c];
          if (cell) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(c * cw, r * ch, cw, ch);
            ctx.clip();
            ctx.fillText(cell, c * cw + 6, r * ch + ch / 2);
            ctx.restore();
          }
        }
      }
      ctx.textBaseline = 'alphabetic';
      break;
    }
    case 'codeSnippet': {
      // IDE-style code pad: VS Code dark palette, title bar with traffic
      // lights, tab bar, line numbers, and lightweight syntax highlighting.
      const code = obj.text || '';
      const PAD = '#0f172a';        // editor background (slate-900)
      const BAR = '#1e293b';        // title/tab bar (slate-800)
      const barH = 24;
      const tabH = 22;
      const gutterW = 26;
      const lh = 15;                // line height

      // Panel
      ctx.fillStyle = PAD;
      roundRect(ctx, 0, 0, obj.width, obj.height, 6);
      ctx.fill();
      // Title bar
      ctx.fillStyle = BAR;
      roundRect(ctx, 0, 0, obj.width, barH, 6);
      ctx.fill();
      ctx.fillRect(0, barH / 2, obj.width, barH / 2);
      // Filename in the title bar
      ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('snippet', 12, 15);
      // Tab bar (single tab)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, barH, 60, tabH);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('code.ts', 8, barH + 14);

      const bodyTop = barH + tabH;
      const maxLines = Math.floor((obj.height - bodyTop - 4) / lh);
      const lines = code.split('\n').slice(0, maxLines);

      ctx.font = '11px ui-monospace, monospace';
      lines.forEach((line, i) => {
        const y = bodyTop + 6 + i * lh;
        // Gutter line number
        ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.textAlign = 'right';
        ctx.fillText(String(i + 1), gutterW - 6, y);
        ctx.textAlign = 'left';
        // Highlighted code
        drawHighlightedCode(ctx, line, gutterW + 6, y);
      });
      ctx.textAlign = 'left';
      break;
    }
    case 'text':
      ctx.font = '16px sans-serif';
      if (obj.text) {
        ctx.fillStyle = obj.fill;
        ctx.fillText(obj.text, 0, 16);
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.fillText('Text', 0, 16);
      }
      break;
    case 'stickyNote':
      ctx.fillStyle = obj.fill || '#ffd93d';
      roundRect(ctx, 0, 0, Math.max(obj.width, 100), Math.max(obj.height, 80), 4);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.font = '14px sans-serif';
      if (obj.text) {
        ctx.fillText(obj.text, 8, 20);
      } else {
        ctx.fillStyle = 'rgba(51, 51, 51, 0.4)';
        ctx.fillText('Note', 8, 20);
      }
      break;
    case 'image':
      if (obj.imageData) {
        let img = imageCache.get(obj.imageData);
        if (!img) {
          img = new Image();
          img.src = obj.imageData;
          img.onload = () => onImageReady?.(obj.imageData!);
          imageCache.set(obj.imageData, img);
        }
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, 0, 0, obj.width, obj.height);
        }
      }
      break;
    case 'connector':
      if (obj.sourceId && obj.targetId) break;
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = obj.strokeWidth;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(obj.width / 2, 0, obj.width / 2, obj.height, obj.width, obj.height);
      ctx.stroke();
      break;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
 * Lightweight syntax highlighting for the code pad. One Dark Pro-ish
 * palette: comments gray-italic, strings green, keywords purple, numbers
 * orange, functions blue. Falls back to plain light text for anything the
 * tokenizer does not recognize.
 */
const CODE_COLORS = {
  default: '#e2e8f0',
  comment: '#7f848e',
  string: '#98c379',
  keyword: '#c678dd',
  number: '#d19a66',
  function: '#61afef',
} as const;

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'new', 'class', 'extends',
  'import', 'from', 'export', 'default', 'async', 'await', 'try', 'catch',
  'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'this', 'null',
  'undefined', 'true', 'false', 'interface', 'type', 'enum', 'public',
  'private', 'protected', 'static', 'readonly', 'void', 'string', 'number',
  'boolean', 'any', 'unknown', 'never', 'def', 'lambda', 'yield', 'pass',
  'with', 'global', 'raise', 'except', 'print', 'int', 'float', 'str', 'list',
  'dict', 'set', 'None', 'True', 'False', 'fn', 'let', 'mut', 'impl', 'struct',
  'match', 'use', 'mod', 'pub', 'async', 'await', 'go', 'package', 'type',
]);

/** Tokenize a single line into [text, color] spans and draw them. */
function drawHighlightedCode(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
): void {
  ctx.font = '11px ui-monospace, monospace';
  const charW = ctx.measureText('0').width;
  let col = 0;
  let i = 0;
  const n = line.length;

  function drawSpan(start: number, end: number, color: string) {
    if (end <= start) return;
    const text = line.slice(start, end);
    ctx.fillStyle = color;
    ctx.fillText(text, x + col * charW, y);
    col += text.length;
  }

  while (i < n) {
    const ch = line[i]!;
    // Comment (// or #)
    if ((ch === '/' && line[i + 1] === '/') || ch === '#') {
      drawSpan(i, n, CODE_COLORS.comment);
      return;
    }
    // String
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < n && line[j] !== ch) {
        if (line[j] === '\\') j++;
        j++;
      }
      drawSpan(i, Math.min(j + 1, n), CODE_COLORS.string);
      i = j + 1;
      continue;
    }
    // Number
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9._]/.test(line[j]!)) j++;
      drawSpan(i, j, CODE_COLORS.number);
      i = j;
      continue;
    }
    // Identifier / keyword / function call
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(line[j]!)) j++;
      const word = line.slice(i, j);
      if (KEYWORDS.has(word)) {
        drawSpan(i, j, CODE_COLORS.keyword);
      } else if (line[j] === '(') {
        drawSpan(i, j, CODE_COLORS.function);
      } else {
        drawSpan(i, j, CODE_COLORS.default);
      }
      i = j;
      continue;
    }
    // Everything else — draw as-is, advance one char
    drawSpan(i, i + 1, CODE_COLORS.default);
    i++;
  }
}

/**
 * Vertex list (in the object's local frame, 0..width / 0..height) for the
 * polygon shapes. Star uses a 5-pointed outer/inner radius pattern.
 */
function polygonPoints(obj: CanvasObject): { x: number; y: number }[] {
  const w = obj.width;
  const h = obj.height;
  const cx = w / 2;
  const cy = h / 2;
  switch (obj.type) {
    case 'triangle':
      return [
        { x: cx, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
    case 'diamond':
      return [
        { x: cx, y: 0 },
        { x: w, y: cy },
        { x: cx, y: h },
        { x: 0, y: cy },
      ];
    case 'pentagon': {
      const r = Math.min(w, h) / 2;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      return pts;
    }
    case 'hexagon': {
      const r = Math.min(w, h) / 2;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * 2 * Math.PI) / 6 + Math.PI / 6;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      return pts;
    }
    case 'star': {
      const outer = Math.min(w, h) / 2;
      const inner = outer * 0.4;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      return pts;
    }
    default:
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
  }
}

function drawSelectionOverlay(ctx: CanvasRenderingContext2D, state: CanvasState, accent: string) {
  if (state.selectedIds.length === 0) return;
  for (const obj of state.objects) {
    if (!state.selectedIds.includes(obj.id)) continue;
    if (obj.type === 'path') continue;
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.rotate((obj.rotation * Math.PI) / 180);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2 / state.zoom;
    ctx.setLineDash([6 / state.zoom, 3 / state.zoom]);
    ctx.strokeRect(-2, -2, obj.width + 4, obj.height + 4);

    const hs = 6 / state.zoom;
    const positions: [number, number][] = [
      [0, 0], [obj.width / 2, 0], [obj.width, 0],
      [obj.width, obj.height / 2],
      [obj.width, obj.height], [obj.width / 2, obj.height], [0, obj.height],
      [0, obj.height / 2],
    ];
    ctx.setLineDash([]);
    ctx.fillStyle = themeColors().bg;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5 / state.zoom;
    for (const [px, py] of positions) {
      ctx.fillRect(px - hs / 2, py - hs / 2, hs, hs);
      ctx.strokeRect(px - hs / 2, py - hs / 2, hs, hs);
    }

    ctx.restore();
  }
}
