import { describe, expect, test } from 'vitest';
import { isObject } from './typeAssertions.js';

describe('typeAssertions', () => {
  describe('isObject', () => {
    test('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
    });

    test('should return false for null', () => {
      expect(isObject(undefined)).toBe(false);
    });

    test('should return false for arrays', () => {
      expect(isObject([])).toBe(false);
    });

    test('should return false for functions', () => {
      expect(isObject(() => {})).toBe(false);
    });
  });
});
