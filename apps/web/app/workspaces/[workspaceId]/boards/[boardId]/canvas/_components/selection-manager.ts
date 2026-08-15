import type { CanvasObject } from '../_context/canvas-state';

export function hitTest(
  point: { x: number; y: number },
  obj: CanvasObject,
  zoom = 1,
): boolean {
  const HalfPI = Math.PI / 180;
  const cos = Math.cos(-obj.rotation * HalfPI);
  const sin = Math.sin(-obj.rotation * HalfPI);
  const dx = point.x - obj.x;
  const dy = point.y - obj.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  switch (obj.type) {
    case 'rectangle':
    case 'image':
    case 'stickyNote':
      return localX >= 0 && localX <= Math.abs(obj.width) && localY >= 0 && localY <= Math.abs(obj.height);
    case 'ellipse': {
      const rx = Math.abs(obj.width) / 2;
      const ry = Math.abs(obj.height) / 2;
      const cx = obj.width / 2;
      const cy = obj.height / 2;
      return ((localX - cx) / rx) ** 2 + ((localY - cy) / ry) ** 2 <= 1;
    }
    case 'line':
    case 'arrow':
      return distanceToSegment(point, { x: obj.x, y: obj.y }, { x: obj.x + obj.width, y: obj.y + obj.height }) < 8 / zoom;
    case 'connector':
      // The connector is a cubic bezier from (0,0) to (w,h) with control
      // points (w/2, 0) and (w/2, h) — mirror the renderer.
      return (
        distanceToCubicBezier(
          { x: localX, y: localY },
          { x: 0, y: 0 },
          { x: obj.width / 2, y: 0 },
          { x: obj.width / 2, y: obj.height },
          { x: obj.width, y: obj.height },
        ) < 8 / zoom
      );
    case 'path':
      return distanceToPolyline({ x: localX, y: localY }, obj.points ?? []) < 8 / zoom;
    case 'text':
      return localX >= 0 && localX <= Math.max(Math.abs(obj.width), 200) && localY >= -16 && localY <= 24;
    default:
      return false;
  }
}

function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function distanceToPolyline(p: { x: number; y: number }, points: { x: number; y: number }[]) {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(p.x - points[0]!.x, p.y - points[0]!.y);
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(p, points[i]!, points[i + 1]!);
    if (d < min) min = d;
  }
  return min;
}

function cubicPoint(t: number, p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/**
 * Approximate the minimum distance from `p` to a cubic bezier by sampling
 * it as a polyline. 24 samples is plenty for an 8px hit threshold.
 */
function distanceToCubicBezier(
  p: { x: number; y: number },
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): number {
  const SAMPLES = 24;
  let min = Infinity;
  let prev = p0;
  for (let i = 1; i <= SAMPLES; i++) {
    const cur = cubicPoint(i / SAMPLES, p0, p1, p2, p3);
    const d = distanceToSegment(p, prev, cur);
    if (d < min) min = d;
    prev = cur;
  }
  return min;
}

export function hitTestHandle(
  point: { x: number; y: number },
  obj: CanvasObject,
  zoom = 1,
): string | null {
  if (obj.type === 'path') return null;
  const threshold = 10 / zoom;
  const corners: { key: string; x: number; y: number }[] = [
    { key: 'nw', x: obj.x, y: obj.y },
    { key: 'n', x: obj.x + obj.width / 2, y: obj.y },
    { key: 'ne', x: obj.x + obj.width, y: obj.y },
    { key: 'e', x: obj.x + obj.width, y: obj.y + obj.height / 2 },
    { key: 'se', x: obj.x + obj.width, y: obj.y + obj.height },
    { key: 's', x: obj.x + obj.width / 2, y: obj.y + obj.height },
    { key: 'sw', x: obj.x, y: obj.y + obj.height },
    { key: 'w', x: obj.x, y: obj.y + obj.height / 2 },
  ];

  for (const c of corners) {
    if (Math.hypot(point.x - c.x, point.y - c.y) < threshold / 2) {
      return c.key;
    }
  }
  return null;
}

export function handleResize(
  obj: CanvasObject,
  handle: string,
  startMouse: { x: number; y: number },
  currentMouse: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = obj;
  const dx = currentMouse.x - startMouse.x;
  const dy = currentMouse.y - startMouse.y;

  switch (handle) {
    case 'nw': x += dx; y += dy; width -= dx; height -= dy; break;
    case 'n': y += dy; height -= dy; break;
    case 'ne': y += dy; width += dx; height -= dy; break;
    case 'e': width += dx; break;
    case 'se': width += dx; height += dy; break;
    case 's': height += dy; break;
    case 'sw': x += dx; width -= dx; height += dy; break;
    case 'w': x += dx; width -= dx; break;
  }

  if (width < 5) { width = 5; }
  if (height < 5) { height = 5; }

  return { x, y, width, height };
}
