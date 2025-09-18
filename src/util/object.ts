import { isObject } from './typeAssertions';

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
