// oxlint-disable-next-line no-explicit-any
export type UnknownObject = Record<string, unknown>;

/**
 * Same as the type `{}`, which does not literally mean an object with no properties.
 */
export type CurlyLips = Record<never, never>;
