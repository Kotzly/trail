/**
 * Generate a UUID v7 (RFC 9562) identifier.
 *
 * Layout (128 bits):
 *   Bits  0–47 : unix_ts_ms  (48-bit millisecond timestamp)
 *   Bits 48–51 : version     (0111)
 *   Bits 52–63 : rand_a      (12 bits random)
 *   Bits 64–65 : variant     (10)
 *   Bits 66–127: rand_b      (62 bits random)
 *
 * The embedded timestamp makes IDs time-ordered and lexicographically
 * sortable, which is ideal for database primary keys.
 */
export function uuidv7(): string {
  const now = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Write 48-bit timestamp in big-endian across bytes 0-5
  const view = new DataView(bytes.buffer);
  view.setUint16(0, Math.floor(now / 0x100000000));
  view.setUint32(2, now % 0x100000000);

  // Version 7 in bits 48-51
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;

  // Variant 10 in bits 64-65
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20)
  );
}
