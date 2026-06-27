/**
 * UUIDv7 generator — time-ordered, globally unique.
 *
 * UUIDv7 is the preferred identifier strategy for Workspace OS (see
 * Part IV-A of the project blueprint). It is:
 * - Lexicographically sortable (great for primary-key locality).
 * - Globally unique, so it's safe to merge data later.
 * - Recognisable by clients as a normal UUID.
 *
 * Layout (RFC 9562):
 *  bits  0–47  : Unix ms timestamp
 *  bits 48–51  : version (always `7`)
 *  bits 52–63  : random frac-of-ms (ordering within ms)
 *  bits 64–65  : variant (always `10`)
 *  bits 66–127 : random
 */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  // Prefer the standard browser/Node global for randomness.
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(out);
    return out;
  }
  // Last-ditch fallback that should never trigger in Node 18+.
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

const HEX = (n: number): string => n.toString(16).padStart(2, '0');

export function uuidv7(): string {
  const r = randomBytes(16);

  // Inject the 48-bit timestamp in ms (big endian).
  const ts = Date.now() & 0xffff_ffff_ffff;
  r[0] = (ts >>> 40) & 0xff;
  r[1] = (ts >>> 32) & 0xff;
  r[2] = (ts >>> 24) & 0xff;
  r[3] = (ts >>> 16) & 0xff;
  r[4] = (ts >>> 8) & 0xff;
  r[5] = ts & 0xff;

  // version (high nibble of byte 6) -> 7
  r[6] = (0x70 | (r[6]! & 0x0f)) & 0xff;
  // variant (high two bits of byte 8) -> 10
  r[8] = (0x80 | (r[8]! & 0x3f)) & 0xff;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(HEX(r[i]!));

  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}
