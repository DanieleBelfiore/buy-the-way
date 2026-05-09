import { ulid } from 'ulid';

/**
 * Branded string type for ULIDs. Prevents accidentally passing plain strings
 * where a ULID is required. Use {@link newId} to construct.
 */
export type ULID = string & { readonly __brand: 'ULID' };

/**
 * Generates a new monotonic ULID.
 *
 * Wraps the `ulid` package so the rest of the codebase depends on the domain
 * layer rather than the third-party module directly. The cast is safe because
 * `ulid()` always returns a 26-char Crockford base32 string.
 */
export const newId = (): ULID => ulid() as ULID;
