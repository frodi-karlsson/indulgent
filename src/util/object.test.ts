import { describe, expect, test } from 'vitest';
import { deepMerge } from './object';

describe('Object utilities', () => {
  const testCases: {
    target: unknown;
    source: unknown;
    expected: unknown;
    description: string;
  }[] = [
    {
      description: 'merging two flat objects',
      target: { a: 1, b: 2 },
      source: { b: 3, c: 4 },
      expected: { a: 1, b: 3, c: 4 },
    },
    {
      description: 'merging nested objects',
      target: { a: { x: 1 }, b: 2 },
      source: { a: { y: 2 }, b: 3 },
      expected: { a: { x: 1, y: 2 }, b: 3 },
    },
    {
      description: 'source has non-object property',
      target: { a: { x: 1 }, b: 2 },
      source: { a: 5 },
      expected: { a: 5, b: 2 },
    },
    {
      description: 'target is not an object',
      target: undefined,
      source: { a: 1 },
      expected: { a: 1 },
    },
    {
      description: 'source is not an object',
      target: { a: 1 },
      source: undefined,
      expected: { a: 1 },
    },
    {
      description: 'both target and source are non-objects',
      target: 42,
      source: 'string',
      expected: 'string',
    },
    {
      description: 'deeply nested objects',
      target: { a: { b: { c: 1 } } },
      source: { a: { b: { d: 2 }, e: 3 }, f: 4 },
      expected: { a: { b: { c: 1, d: 2 }, e: 3 }, f: 4 },
    },
  ];

  test.each(testCases)(
    'should correctly merge when $description',
    ({ target, source, expected }) => {
      const result = deepMerge(target, source);
      expect(result).toEqual(expected);
    },
  );
});
