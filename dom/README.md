# @indulgent/dom

An extremely lightweight DOM binding library for [indulgent](https://frodi-karlsson.github.io/indulgent/) signals. No syntax that can't be rendered in plain HTML, no virtual DOM, no frameworks.

Can either be used as a module, with a bundler, or directly in the browser with a script tag, e.g `<script src="https://unpkg.com/@indulgent/dom/dist/index.cdn.js"></script>`.

See more details in the docs.

## DOM bindings

Bind indulgent signals to DOM elements using custom attributes.

- `obind:` - one-way binding from signal to DOM element
- `ibind:` - one-way binding from DOM element to signal
- `iobind:` - two-way binding between signal and DOM element

```ts
import { createSignal } from 'indulgent/signal';
import { initIndulgent } from '@indulgent/dom';

const name = createSignal('World');
const address = createSignal('Earth');

initIndulgent({ address, name });
```

```html
<div obind:text_content="name"></div>
<input ibind:value="name" />
<input iobind:value="address" />
<button onclick="address.set('Mars')">Set address to Mars</button>
```

As you can see, the library aims for supporting differently cased property names through snake_case.
Here are some examples of supported properties:

- `textContent` / `text_content`
- `innerHTML` / `inner_html`
- `value`
- `checked`
