import type { Logger } from '../util/logger.js';

/**
 * Simplest possible event emitter.
 * Listeners are called synchronously when an event is emitted.
 */
export class SingleEventEmitter<T> {
  private listeners = new Set<(event: ValueArgs<T>) => void>();
  on(listener: (event: ValueArgs<T>) => void) {
    this.listeners.add(listener);
  }
  off(listener: (event: ValueArgs<T>) => void) {
    this.listeners.delete(listener);
  }
  emit(event: ValueArgs<T>) {
    for (const listener of this.listeners) {
      listener(structuredClone(event));
    }
  }
}

const NO_EMIT_VALUE = Symbol('NO_EMIT_VALUE');
/**
 * Event emitter that schedules listener calls to the next microtask.
 * If multiple emits happen before the microtask runs, the listener is only called with the latest event.
 */
export class NextMicroTaskEmitter<T> {
  private logger?: Logger;
  constructor(logger?: Logger) {
    this.logger = logger;
  }

  private listeners = new Set<(event: T) => void>();
  private scheduledUpdates = new Set<(event: T) => void>();
  private updateQueued = false;
  private lastEvent: T | typeof NO_EMIT_VALUE = NO_EMIT_VALUE;

  on(listener: (event: T) => void) {
    this.logger?.('info', `Listener added`);
    this.listeners.add(listener);
  }

  off(listener: (event: T) => void) {
    this.logger?.('info', `Listener removed`);
    this.listeners.delete(listener);
    this.scheduledUpdates.delete(listener);
  }

  emit(event: ValueArgs<T>) {
    this.logger?.('info', `Emit called with event: ${event}`);
    if (this.updateQueued) {
      this.scheduledUpdates.clear();
    }

    for (const listener of this.listeners) {
      this.scheduledUpdates.add(listener);
    }

    this.lastEvent = event as T;

    this.updateQueued = true;
    queueMicrotask(() => {
      this.processUpdates();
    });
  }

  private processUpdates() {
    if (this.lastEvent === NO_EMIT_VALUE) {
      throw new EventEmitterError('No event to process');
    }

    for (const update of this.scheduledUpdates) {
      this.logger?.('info', `Processing update`);
      update(structuredClone(this.lastEvent));
    }
    this.scheduledUpdates.clear();
    this.updateQueued = false;
  }
}

export class EventEmitterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventEmitterError';
  }
}

export type ValueArgs<T> = T extends undefined ? never | undefined : T;
