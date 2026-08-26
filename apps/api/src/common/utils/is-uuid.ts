const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * True only for well-formed RFC 9562-ish UUID strings.
 *
 * Used on values that flow into filesystem paths or storage keys so a
 * crafted id like `../../etc` can never traverse a directory boundary —
 * regardless of which storage backend is active.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
