import { parseNumber } from './presets';

// react-number-format v4 runs its onFocus inside setTimeout(0), and Meteora's
// percent field reads React state in onBlur, so each step needs a rendered frame.
const SETTLE_MS = 40;
const POLL_MS = 30;

const nativeValueSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  'value',
)!.set!;

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Resolves true when the check passes, or false if the timeout runs out first. */
export async function waitFor(
  check: () => boolean,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<boolean> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (check()) return true;
    await sleep(POLL_MS, signal);
  }
  return check();
}

/**
 * Waits until `read` has stopped changing for `quietMs`. Running out of time is
 * not an error: live pools keep nudging the percentages as the active bin moves.
 */
export async function waitForQuiet(
  read: () => string,
  quietMs: number,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  let last = read();
  let lastChange = performance.now();
  while (performance.now() < deadline) {
    await sleep(POLL_MS, signal);
    const current = read();
    if (current !== last) {
      last = current;
      lastChange = performance.now();
    } else if (performance.now() - lastChange >= quietMs) {
      return;
    }
  }
}

function showsText(input: HTMLInputElement, text: string): boolean {
  return text === '' ? input.value === '' : parseNumber(input.value) === Number(text);
}

/** Types into a React-controlled number field and commits it with a real blur. */
export async function typeAndCommit(
  input: HTMLInputElement,
  text: string,
  signal: AbortSignal,
): Promise<void> {
  input.focus();
  await sleep(SETTLE_MS, signal);

  input.select();
  nativeValueSetter.call(input, text);
  input.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
  );
  await sleep(SETTLE_MS, signal);

  if (!showsText(input, text)) {
    input.focus();
    input.select();
    if (text === '') document.execCommand('delete');
    else document.execCommand('insertText', false, text);
    await sleep(SETTLE_MS, signal);
  }

  // React's onBlur listens for focusout, which a dispatched "blur" would never reach.
  if (document.activeElement === input) input.blur();
  else input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  await sleep(SETTLE_MS, signal);
}
