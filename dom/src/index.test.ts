import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSignal } from 'indulgent/signal';
import { initIndulgent } from './index.js';

describe('initIndulgent', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('obind', () => {
    test('should bind signal to element property', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" obind:value="mySignal" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        mySignal: createSignal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body });
      expect(input.value).toBe('Initial Value');

      ctx.mySignal.set('Updated Value');
      await vi.runAllTimersAsync();

      expect(input.value).toBe('Updated Value');
    });
  });
  describe('ibind', () => {
    test('should update signal on input event', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" ibind:value="mySignal" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        mySignal: createSignal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body });
      expect(ctx.mySignal.get()).toBe('Initial Value');

      input.value = 'User Input';
      input.dispatchEvent(new Event('input'));

      await vi.runAllTimersAsync();
      expect(ctx.mySignal.get()).toBe('User Input');
    });
  });
  describe('iobind', () => {
    test('should bind signal to element property and update signal on input event', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" iobind:value="mySignal" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        mySignal: createSignal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body });
      expect(input.value).toBe('Initial Value');

      ctx.mySignal.set('Updated Value');
      await vi.runAllTimersAsync();
      expect(input.value).toBe('Updated Value');

      input.value = 'User Input';
      input.dispatchEvent(new Event('input'));

      await vi.runAllTimersAsync();
      expect(ctx.mySignal.get()).toBe('User Input');
    });

    test('should warn for unsupported property binding', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" iobind:title="mySignal" />
        </div>
      `;
      const ctx = {
        mySignal: createSignal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[indulgent]',
        'Two-way binding for property "title" is not supported out of the box. Please set up a custom event listener to update the signal.',
        expect.any(HTMLElement),
      );

      consoleWarnSpy.mockRestore();
    });

    test('should warn if signal not found in context', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" iobind:value="nonExistentSignal" />
        </div>
      `;
      const ctx = {
        mySignal: createSignal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[indulgent]',
        'Signal "nonExistentSignal" is not defined in context',
      );

      consoleWarnSpy.mockRestore();
    });

    test('should warn if context property is not a signal', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" iobind:value="notASignal" />
        </div>
      `;
      const ctx = {
        notASignal: 42,
      };

      initIndulgent(ctx as any, { root: document.body, debug: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[indulgent]',
        '"notASignal" is not a signal',
        42,
      );

      consoleWarnSpy.mockRestore();
    });

    const lowerCasePropertyTests = [
      { attr: 'obind:inner_html', prop: 'innerHTML' },
      { attr: 'obind:inner_text', prop: 'innerText' },
      { attr: 'obind:text_content', prop: 'textContent' },
    ];
    test.each(lowerCasePropertyTests)(
      'should handle lower_case property names in bindings: $attr -> $prop',
      async ({ attr, prop }) => {
        document.body.innerHTML = `
        <div>
          <div id="div" ${attr}="mySignal"></div>
        </div>
      `;
        const div = document.getElementById('div') as HTMLDivElement;
        const ctx = {
          mySignal: createSignal('Initial Value'),
        };

        initIndulgent(ctx, { root: document.body });
        expect((div as any)[prop]).toBe('Initial Value');

        ctx.mySignal.set('Updated Value');
        await vi.runAllTimersAsync();

        expect((div as any)[prop]).toBe('Updated Value');
      },
    );
  });

  describe('multiple bindings', () => {
    test('should handle multiple bindings on the same element', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" ibind:value="valueSignal" obind:placeholder="placeholder" />
        </div>
      `;

      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        valueSignal: createSignal(''),
        placeholder: createSignal('Placeholder'),
      };

      initIndulgent(ctx, { root: document.body });
      expect(input.placeholder).toBe('Placeholder');
      expect(input.value).toBe('');

      ctx.placeholder.set('New Placeholder');
      await vi.runAllTimersAsync();
      expect(input.placeholder).toBe('New Placeholder');

      input.value = 'User Input';
      input.dispatchEvent(new Event('input'));
      await vi.runAllTimersAsync();
      expect(ctx.valueSignal.get()).toBe('User Input');
    });
  });
});
