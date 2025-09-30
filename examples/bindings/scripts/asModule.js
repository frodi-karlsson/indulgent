import { effect } from 'indulgent';
import { initIndulgent } from 'indulgent-dom';
import { storeSignal } from 'indulgent/signal';

// Initializes a signal that's persisted in localStorage
const count = storeSignal('count', 0);

effect(() => {
  console.log(`Count is now: ${count.get()}`);
});

initIndulgent({
  count,
});

document.querySelector('#incrementBtn')?.addEventListener('click', () => {
  count.set(count.get() + 1);
});

document.querySelector('#decrementBtn')?.addEventListener('click', () => {
  count.set(count.get() - 1);
});
