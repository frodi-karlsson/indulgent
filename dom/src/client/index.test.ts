import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, signal } from 'indulgent/signal';
import { initIndulgent } from './index.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

describe('initIndulgent', () => {
  describe('obind', () => {
    test('should bind signal to element property', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input" type="text" obind:value="mySignal" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        mySignal: signal('Initial Value', { logger: console.warn }),
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
        mySignal: signal('Initial Value'),
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
        mySignal: signal('Initial Value'),
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
        mySignal: signal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[indulgent]',
        'Input binding for property "title" is not supported out of the box. Please set up a custom event listener to update the signal.',
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
        mySignal: signal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[indulgent]',
        '"nonExistentSignal" is not a signal',
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
          mySignal: signal('Initial Value'),
        };

        initIndulgent(ctx, { root: document.body });
        expect((div as any)[prop]).toBe('Initial Value');

        ctx.mySignal.set('Updated Value');
        await vi.runAllTimersAsync();

        expect((div as any)[prop]).toBe('Updated Value');
      },
    );

    test('should handle computed signal depending on another computed signal', async () => {
      document.body.innerHTML = `
        <div>
          <h1 id="header" obind:text_content="computedSignal2"></h1>
        </div>
      `;
      const baseSignal = signal('World');
      const computedSignal = computed(() => `Hello, ${baseSignal.get()}!`);
      const computedSignal2 = computed(() =>
        computedSignal.get().toUpperCase(),
      );
      const ctx = {
        computedSignal2,
      };
      initIndulgent(ctx, { root: document.body });

      const header = document.getElementById('header') as HTMLHeadingElement;
      expect(header.textContent).toBe('HELLO, WORLD!');

      baseSignal.set('Indulgent');
      await vi.runAllTimersAsync();
      expect(header.textContent).toBe('HELLO, INDULGENT!');
    });
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
        valueSignal: signal(''),
        placeholder: signal('Placeholder'),
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

  describe('multiple calls to initIndulgent', () => {
    test('should handle multiple calls to initIndulgent on the same root', async () => {
      document.body.innerHTML = `
        <div>
          <input id="input1" type="text" obind:value="signal1" />
          <input id="input2" type="text" obind:value="signal2" />
        </div>
      `;

      const input1 = document.getElementById('input1') as HTMLInputElement;
      const input2 = document.getElementById('input2') as HTMLInputElement;
      const ctx1 = {
        signal1: signal('Value 1'),
      };
      const ctx2 = {
        signal2: signal('Value 2'),
      };

      initIndulgent(ctx1, { root: document.body, debug: true });
      initIndulgent(ctx2, { root: document.body, debug: true });

      expect(input1.value).toBe('Value 1');
      expect(input2.value).toBe('Value 2');

      ctx1.signal1.set('Updated Value 1');
      ctx2.signal2.set('Updated Value 2');
      await vi.runAllTimersAsync();

      expect(input1.value).toBe('Updated Value 1');
      expect(input2.value).toBe('Updated Value 2');
    });

    test('should not re-initialize bindings on subsequent calls to initIndulgent with same root', async () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      document.body.innerHTML = `
        <div>
          <input id="input" type="text" obind:value="mySignal" />
        </div>
      `;
      const input = document.getElementById('input') as HTMLInputElement;
      const ctx = {
        mySignal: signal('Initial Value'),
      };

      initIndulgent(ctx, { root: document.body, debug: true });
      expect(input.value).toBe('Initial Value');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[indulgent]',
        'Setting up output binding for property "value" and signal "mySignal"',
        input,
      );

      consoleLogSpy.mockClear();

      // Second call with same root
      initIndulgent(ctx, { root: document.body, debug: true });
      expect(input.value).toBe('Initial Value');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    test('should initialize bindings for new root elements', async () => {
      document.body.innerHTML = `
        <div id="root1">
          <input id="input1" type="text" obind:value="signal1" />
        </div>
        <div id="root2">
          <input id="input2" type="text" obind:value="signal2" />
        </div>
      `;

      const root1 = document.getElementById('root1') as HTMLDivElement;
      const root2 = document.getElementById('root2') as HTMLDivElement;
      const input1 = document.getElementById('input1') as HTMLInputElement;
      const input2 = document.getElementById('input2') as HTMLInputElement;
      const ctx1 = {
        signal1: signal('Value 1'),
      };
      const ctx2 = {
        signal2: signal('Value 2'),
      };

      initIndulgent(ctx1, { root: root1, debug: true });
      expect(input1.value).toBe('Value 1');

      initIndulgent(ctx2, { root: root2, debug: true });
      expect(input2.value).toBe('Value 2');
    });
  });
});

describe('integration', () => {
  test('buggy styles example', async () => {
    document.body.innerHTML = `
      <div id="container" obind:style="containerStyle">
        <h1>Welcome to Indulgent!</h1>
        <p>This is a simple example demonstrating dynamic styles.</p>
      </div>
    `;

    const isOpen = signal(false);
    const backgroundColor = computed(() => {
      const open = isOpen.get();
      console.log('Recomputing backgroundColor, isOpen:', open);
      if (open) {
        return '#0a0a0a';
      }
      return '#ffffff';
    });
    const foregroundColor = computed(() => {
      const open = isOpen.get();
      if (open) {
        return '#ffffff';
      }
      return '#000000';
    });
    const containerStyle = computed(() => {
      const bg = backgroundColor.get();
      const fg = foregroundColor.get();
      return `
            background-color: ${bg};
            color: ${fg};
            transition: background-color 0.5s, color 0.5s;
            width: 100%;
            height: 100vh;
            display: flex;
            align-items: center;
            padding: 0 40px;
        `;
    });
    const container = document.getElementById('container') as HTMLDivElement;
    initIndulgent(
      {
        isOpen,
        containerStyle,
      },
      { debug: true },
    );

    expect(containerStyle.get()).toBe(
      `
            background-color: #ffffff;
            color: #000000;
            transition: background-color 0.5s, color 0.5s;
            width: 100%;
            height: 100vh;
            display: flex;
            align-items: center;
            padding: 0 40px;
        `,
    );
    expect(container.style.backgroundColor).toBe('#ffffff');
    expect(container.style.color).toBe('#000000');

    isOpen.set(true);
    await vi.runAllTimersAsync();

    expect(container.style.backgroundColor).toBe('#0a0a0a');
    expect(container.style.color).toBe('#ffffff');
  });
});
