import { monotonicFactory } from 'ulid';

export type ULID = string & { readonly __brand: 'ULID' };

const _ulid = monotonicFactory();

export const newId = (): ULID => _ulid() as ULID;
