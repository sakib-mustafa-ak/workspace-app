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
