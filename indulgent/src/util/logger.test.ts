import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { blue, createBaseLogger, gray, green, red, yellow } from './logger.js';

describe('createBaseLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:34:56.789Z'));
    // We need to set tz to UTC to ensure consistent test results
    // oxlint-disable-next-line no-undef
    process.env.TZ = 'UTC';
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  test('should log info messages with gray timestamp and green prefix', () => {
    const consoleLogSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => {});
    const logger = createBaseLogger('TEST');

    logger('info', 'This is an info message');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `[${gray('12:34:56')}]`,
      `[${green('TEST')}]`,
      'This is an info message',
    );
  });

  test('should log warn messages with gray timestamp and yellow prefix', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const logger = createBaseLogger('TEST');

    logger('warn', 'This is a warning message');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `[${gray('12:34:56')}]`,
      `[${yellow('TEST')}]`,
      'This is a warning message',
    );
  });

  test('should log error messages with gray timestamp and red prefix', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const logger = createBaseLogger('TEST');

    logger('error', 'This is an error message');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[${gray('12:34:56')}]`,
      `[${red('TEST')}]`,
      'This is an error message',
    );
  });

  test('should log debug messages with gray timestamp and blue prefix', () => {
    const consoleDebugSpy = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => {});
    const logger = createBaseLogger('TEST');

    logger('debug', 'This is a debug message');

    expect(consoleDebugSpy).toHaveBeenCalledWith(
      `[${gray('12:34:56')}]`,
      `[${blue('TEST')}]`,
      'This is a debug message',
    );
  });

  test('should handle multiple arguments', () => {
    const consoleLogSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => {});
    const logger = createBaseLogger('TEST');

    logger('info', 'Message part 1', { key: 'value' }, [1, 2, 3]);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `[${gray('12:34:56')}]`,
      `[${green('TEST')}]`,
      'Message part 1',
      { key: 'value' },
      [1, 2, 3],
    );
  });

  test('should have a context property', () => {
    const logger = createBaseLogger('MY_CONTEXT');
    expect(logger.context).toBe('MY_CONTEXT');
  });
});
