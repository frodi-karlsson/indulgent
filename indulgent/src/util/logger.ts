export type LoggerLevel = 'info' | 'warn' | 'error' | 'debug';
export type Logger = ((severity: LoggerLevel, ...args: any[]) => void) & {
  context: string;
};

const isBrowser =
  // oxlint-disable-next-line prefer-global-this
  typeof window !== 'undefined' && typeof window.document !== 'undefined';

function colorWithReset(code: number, text: string): string {
  // oxlint-disable-next-line prefer-global-this
  if (isBrowser) {
    return text;
  }

  return `\x1b[${code}m${text}\x1b[0m`;
}

export function red(text: string): string {
  return colorWithReset(31, text);
}

export function green(text: string): string {
  return colorWithReset(32, text);
}

export function yellow(text: string): string {
  return colorWithReset(33, text);
}

export function blue(text: string): string {
  return colorWithReset(34, text);
}

export function gray(text: string): string {
  return colorWithReset(90, text);
}

/**
 * Creates a base logger function that logs messages to the console with a timestamp and context.
 * The logger supports different severity levels: 'info', 'warn', 'error', and 'debug'.
 *
 * @example
 * ```ts
 * const logger = createBaseLogger('MyApp');
 * logger('info', 'This is an informational message.');
 *
 * // Console output:
 * // [12:34:56] [MyApp] This is an informational message.
 * ```
 */
export function createBaseLogger(context: string): Logger {
  function logger(severity: LoggerLevel, ...args: any[]) {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');
    const time = `${hour}:${minute}:${second}`;
    let contextColor = gray;
    if (severity === 'warn') {
      contextColor = yellow;
    } else if (severity === 'error') {
      contextColor = red;
    } else if (severity === 'debug') {
      contextColor = blue;
    } else if (severity === 'info') {
      contextColor = green;
    }
    console[severity](`[${gray(time)}]`, `[${contextColor(context)}]`, ...args);
  }

  return Object.assign(logger, { context });
}
