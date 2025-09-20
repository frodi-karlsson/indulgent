import { describe, expect, test } from 'vitest';
import { stringifyIfNotString } from './json';

describe('JSON utilities', () => {
  describe('stringifyIfNotString', () => {
    test("should return the input if it's already a string", () => {
      const input = 'test';
      const result = stringifyIfNotString(input);
      expect(result).toBe(input);
    });

    test("should stringify the input if it's not a string", () => {
      const input = { key: 'value' };
      const result = stringifyIfNotString(input);
      expect(result).toBe(JSON.stringify(input));
    });

    test('should handle numbers correctly', () => {
      const input = 42;
      const result = stringifyIfNotString(input);
      expect(result).toBe('42');
    });

    test('should handle arrays correctly', () => {
      const input = [1, 2, 3];
      const result = stringifyIfNotString(input);
      expect(result).toBe(JSON.stringify(input));
    });

    test('should handle null correctly', () => {
      const input = null;
      const result = stringifyIfNotString(input);
      expect(result).toBe('null');
    });

    test('should handle undefined correctly', () => {
      const input = undefined;
      const result = stringifyIfNotString(input);
      expect(result).toBe(JSON.stringify(input));
    });

    test('should handle undefined correctly', () => {
      const input = undefined;
      const result = stringifyIfNotString(input);
      expect(result).toBe(JSON.stringify(input));
    });
  });
});
