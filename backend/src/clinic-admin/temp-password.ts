import { randomInt } from 'crypto';

// Unambiguous alphabet (no 0/O/1/l/I) — a human retypes this once.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const LENGTH = 16;

/**
 * Cryptographically strong one-time temporary password (DEC-018 T3).
 * Returned to the Clinic Admin exactly once, never persisted in plaintext,
 * never logged / audited / put in an exception or fixture.
 */
export function generateTemporaryPassword(): string {
  let out = '';
  for (let i = 0; i < LENGTH; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}
