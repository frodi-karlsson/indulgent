import type { UnknownObject } from '../types/object';

export function isObject(item: unknown): item is UnknownObject {
  return !!item && typeof item === 'object' && !Array.isArray(item);
}
