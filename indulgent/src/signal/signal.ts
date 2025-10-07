import { type Logger, createBaseLogger } from '../util/logger.js';
import { NextMicroTaskEmitter, type ValueArgs } from './eventEmitter.js';

interface SignalOptions<T> {
  equalsFn?: (a: T, b: T) => boolean;
  logger?: Logger;
}

/**
 * Describes a signal that can be read from.
 *
 * The important part to understand is `signal.get()`. The rest are intended
 * to be called by library code, although you can call them if you want to.
 */
export interface ReadSignal<T> {
  /**
   * A marker property to identify this as a signal-like object.
   */
  _readSignal: true;
  /**
   * Get the current value of the signal.
   * If done inside a reactive context (computed signal or effect),
   * the signal will be tracked as a dependency.
   *
   * @example
   * ```ts
   * const count = signal(0);
   * console.log(count.get()); // 0
   * count.set(5);
   * console.log(count.get()); // 5
   * ```
   */
  get(): T;
  /**
   * Register a listener that will be called when the signal's value changes.
   */
  registerDependent(listener: (value: T) => void): void;
  /**
   * Unregister a listener that was previously registered.
   */
  unregisterDependent(listener: (value: T) => void): boolean;
  /**
   * Unregister all listeners that were previously registered.
   */
  unregisterAllDependents(): void;
}

/**
 * Describes a signal that can be written to.
 */
export interface WriteSignal<T> {
  /**
   * A marker property to identify this as a signal-like object.
   */
  _writeSignal: true;
  /**
   * Queues setting a new value for the signal to the next microtask.
   * If the new value is different from the current value (based on the equality function),
   * all registered dependents will be notified of the new value.
   */
  set(newValue: T): void;
  /**
   * Queues updating the signal's value based on its current value to the next microtask.
   * If the new value is different from the current value (based on the equality function),
   * all registered dependents will be notified of the new value.
   */
  update(cb: (oldValue: T) => T): void;
}

export type Signal<T> = ReadSignal<T> & WriteSignal<T>;

class SignalImplementation<T> implements Signal<T> {
  _readSignal = true as const;
  _writeSignal = true as const;
  private value: T;
  private equalsFn: (a: T, b: T) => boolean;
  private emitter: NextMicroTaskEmitter<T>;
  private dependents = new Set<(value: T) => void>();
  private logger?: Logger;

  constructor(initialValue: T, options?: SignalOptions<T>) {
    this.value = initialValue;
    this.equalsFn =
      options?.equalsFn ?? ((a, b) => JSON.stringify(a) === JSON.stringify(b));
    this.logger = options?.logger;
    let internalLogger: Logger | undefined = undefined;
    if (options?.logger) {
      internalLogger = createBaseLogger(`${options.logger.context}->EMITTER`);
    }
    this.emitter = new NextMicroTaskEmitter<T>(internalLogger);
  }

  get(): T {
    this.logger?.('info', `Signal get: ${this.value}`);
    reaction?.(this);
    return structuredClone(this.value);
  }

  set(newValue: T): void {
    this.logger?.('info', `Signal set: ${JSON.stringify(newValue)}`);
    if (!this.equalsFn(this.value, newValue)) {
      this.value = newValue;
      this.emitter.emit(newValue as ValueArgs<T>);
    }
  }

  update(cb: (oldValue: T) => T): void {
    const newValue = cb(structuredClone(this.value));
    this.logger?.('info', `Signal update: ${JSON.stringify(newValue)}`);
    this.set(newValue);
  }

  registerDependent(listener: (value: T) => void): void {
    this.logger?.('info', `Registering dependent for signal`);
    const previousSize = this.dependents.size;
    this.dependents.add(listener);
    if (this.dependents.size > previousSize) {
      this.emitter.on(listener);
    }
  }

  unregisterDependent(listener: (value: T) => void): boolean {
    this.logger?.('info', `Unregistering dependent for signal`);
    const found = this.dependents.delete(listener);
    if (found) {
      this.emitter.off(listener);
    }
    return found;
  }

  unregisterAllDependents(): void {
    this.logger?.('info', `Unregistering all dependents for signal`);
    for (const listener of this.dependents) {
      this.emitter.off(listener);
    }
    this.dependents.clear();
  }
}

export function signal<T extends undefined>(): Signal<T>;
export function signal<T>(
  initialValue: T,
  options?: SignalOptions<T>,
): Signal<T>;
export function signal<T>(
  initialValue?: T,
  options?: SignalOptions<T>,
): Signal<T> {
  return new SignalImplementation(initialValue as T, options);
}

export function storeSignal<T extends undefined>(key: string): Signal<T>;
export function storeSignal<T>(
  key: string,
  initialValue: T,
  options?: SignalOptions<T> & { storage?: Storage },
): Signal<T>;
export function storeSignal<T>(
  key: string,
  initialValue?: T,
  options?: SignalOptions<T> & { storage?: Storage },
): Signal<T> {
  const storage = options?.storage ?? localStorage;
  const storedValue = storage.getItem(key);
  let parsedValue: T;
  if (storedValue !== null) {
    try {
      parsedValue = JSON.parse(storedValue) as T;
    } catch (error) {
      throw new SignalError(
        `Failed to parse stored value for key "${key}": ${error}`,
      );
    }
  } else {
    parsedValue = initialValue as T;
    storage.setItem(key, JSON.stringify(parsedValue));
  }
  const signalInstance = signal<T>(parsedValue, {
    equalsFn(a, b) {
      const storeValue = storage.getItem(key);
      if (storeValue === null) {
        return a === b;
      }
      try {
        const storedParsed = JSON.parse(storeValue) as T;
        return JSON.stringify(storedParsed) === JSON.stringify(b) && a === b;
      } catch {
        return a === b;
      }
    },
  });
  signalInstance.registerDependent((newValue) => {
    storage.setItem(key, JSON.stringify(newValue));
  });
  return signalInstance;
}

// not concurrency-safe
let reaction: ((signal: ReadSignal<any>) => void) | null = null;

function track<T>(callback: () => T): ReadSignal<any>[] {
  const prevReaction = reaction;
  const signals: ReadSignal<any>[] = [];
  reaction = (signal: ReadSignal<any>) => {
    signals.push(signal);
  };
  try {
    callback();
  } finally {
    reaction = prevReaction;
  }
  return signals;
}

export class ComputedSignalImplementation<T> implements ReadSignal<T> {
  _readSignal = true as const;
  private computeFn: () => T;
  private signal: SignalImplementation<T>;
  private dependencies = new Set<ReadSignal<any>>();
  private logger?: Logger;
  private scheduled = false;

  constructor(computeFn: () => T, options?: SignalOptions<T>) {
    this.computeFn = computeFn;
    let internalLogger: Logger | undefined = undefined;
    if (options?.logger) {
      internalLogger = createBaseLogger(`${options.logger.context}->COMPUTED`);
    }
    this.signal = new SignalImplementation(undefined as T, {
      logger: internalLogger,
      equalsFn: options?.equalsFn,
    });
    this.logger = options?.logger;
    this.track();
  }

  private dependencyFn = () => {
    this.logger?.('info', `Computed signal dependency changed`);
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.logger?.('info', `Recomputing computed signal value`);
      this.track();
    });
  };

  private track(): void {
    let value: T | undefined;
    const dependencies = track(() => {
      value = this.computeFn();
      this.logger?.(
        'info',
        `Computed value updated to ${JSON.stringify(value)}`,
      );
    });
    this.signal.set(value as T);
    this.dependencies.forEach((dep) => {
      if (dependencies.includes(dep)) {
        return;
      } else {
        this.logger?.('info', `Dependency no longer needed, unregistering`);
        const found = dep.unregisterDependent(this.dependencyFn);
        if (found) {
          this.logger?.('info', `Unregistered dependency from computed signal`);
        } else {
          this.logger?.('info', `Dependency was not found in computed signal`);
        }
      }
    });
    for (const dep of dependencies) {
      if (this.dependencies.has(dep)) {
        continue;
      } else {
        this.logger?.('info', `New dependency found, registering`);
        dep.registerDependent(this.dependencyFn);
        this.logger?.('info', `Registered dependency for computed signal`);
      }
      this.dependencies.add(dep);
    }
    this.logger?.(
      'info',
      `Computed signal tracking ${dependencies.length} dependencies`,
    );
  }

  get() {
    this.logger?.('info', `Getting computed signal value`);
    return this.signal.get();
  }

  registerDependent(listener: (value: T) => void) {
    this.logger?.('info', `Registering dependent for computed signal`);
    this.signal.registerDependent(listener);
  }

  unregisterDependent(listener: (value: T) => void) {
    this.logger?.('info', `Unregistering dependent for computed signal`);
    return this.signal.unregisterDependent(listener);
  }

  unregisterAllDependents() {
    this.logger?.('info', `Unregistering all dependents for computed signal`);
    this.signal.unregisterAllDependents();
  }
}

export function computed<T>(
  computeFn: () => T,
  options?: SignalOptions<T>,
): ComputedSignalImplementation<T> {
  return new ComputedSignalImplementation(computeFn, options);
}

export class Effect {
  private effectFn: () => void;
  private dependencies = new Set<ReadSignal<any>>();
  private scheduled = false;
  private logger?: Logger;

  constructor(effectFn: () => void, options?: { logger?: Logger }) {
    this.effectFn = effectFn;
    this.logger = options?.logger;
    this.track();
  }

  dependencyFn = () => {
    this.logger?.('info', `Effect dependency changed, re-running effect`);
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.track();
    });
  };

  private track() {
    const signals = track(() => {
      this.effectFn();
    });
    for (const dep of this.dependencies) {
      if (signals.includes(dep)) {
        continue;
      } else {
        dep.unregisterDependent(this.dependencyFn);
        this.dependencies.delete(dep);
      }
    }
    for (const signal of signals) {
      if (this.dependencies.has(signal)) {
        continue;
      } else {
        signal.registerDependent(this.dependencyFn);
        this.dependencies.add(signal);
      }
    }
  }
}

export function effect(
  effectFn: () => void | (() => void),
  options?: { logger?: Logger },
): Effect {
  return new Effect(effectFn, options);
}

export class SignalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignalError';
  }
}
