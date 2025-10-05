import { isObject } from './typeAssertions.js';

export function deepMerge<T>(target: unknown, source: unknown): T {
  if (!isObject(target)) {
    return source as T;
  }
  if (!isObject(source)) {
    return target as T;
  }

  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (!isObject(source[key])) {
      Object.assign(output, { [key]: source[key] });
      continue;
    }

    if (!(key in target)) {
      Object.assign(output, { [key]: source[key] });
      continue;
    }

    output[key] = deepMerge(target[key], source[key]);
  }
  return output as T;
}

export function getPath<T>(obj: any, path: string): T | undefined {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    current = current[part];
  }
  return current as T;
}
