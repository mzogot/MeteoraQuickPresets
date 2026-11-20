import { parseNumber, parsePrice, type Strategy } from './presets';

/** A failure with a message written to be shown to the user. */
export class PresetError extends Error {}

// Meteora marks the panel's sections for its guided tour. Nothing else on the page names them.
const tour = (name: string) => `[data-tour="${name}"]`;

export interface TokenField {
  symbol: string;
  input: HTMLInputElement;
  /** Null when the row isn't showing, such as with no wallet connected. */
  balanceButton: HTMLButtonElement | null;
  /** Meteora's shortcuts by label, such as "25%". Users can edit these. */
  percentButtons: Map<string, HTMLButtonElement>;
}

export interface Panel {
  autoFillLabel: HTMLElement;
  autoFillToggle: HTMLButtonElement;
  tokenX: TokenField;
  tokenY: TokenField;
  strategyButtons: Map<string, HTMLButtonElement>;
  minInput: HTMLInputElement;
  maxInput: HTMLInputElement;
  pairLabel: string;
}

export interface RangeSnapshot {
  minPct: number;
  maxPct: number;
  bins: number | null;
}

const isVisible = (element: Element) => element.getClientRects().length > 0;

/**
 * The Create Position form. The add-liquidity form on existing positions is the
 * same component, but Meteora leaves its price range out of the tour.
 */
export function findCreateForm(): HTMLFormElement | null {
  for (const range of document.querySelectorAll(tour('price-range'))) {
    if (!isVisible(range)) continue;
    const form = range.closest('form');
    if (form?.querySelector(tour('amount-input-x')) && form.querySelector(tour('strategy'))) {
      return form;
    }
  }
  return null;
}

function requireElement<T extends Element>(element: T | null | undefined, name: string): T {
  if (!element) {
    throw new PresetError(`Couldn't find ${name}. Meteora's page may have changed.`);
  }
  return element;
}

/** The nearest match going up from `start`, without leaving `within`. */
function findNearby<T extends Element>(start: Element, selector: string, within: Element): T | null {
  for (let node = start.parentElement; node; node = node.parentElement) {
    const match = node.querySelector<T>(selector);
    if (match || node === within) return match;
  }
  return null;
}

/** The field's own card: the largest block around it holding no other amount field. */
function findFieldCard(wrapper: Element): Element {
  let card = wrapper;
  for (let node = wrapper.parentElement; node; node = node.parentElement) {
    if (node.querySelectorAll('[data-tour^="amount-input-"]').length > 1) break;
    card = node;
  }
  return card;
}

function readTokenField(form: HTMLFormElement, side: 'x' | 'y'): TokenField {
  const wrapper = requireElement(
    form.querySelector(tour(`amount-input-${side}`)),
    `the token ${side.toUpperCase()} field`,
  );

  let balanceButton: HTMLButtonElement | null = null;
  const percentButtons = new Map<string, HTMLButtonElement>();
  for (const button of findFieldCard(wrapper).querySelectorAll('button')) {
    const label = button.innerText.trim();
    if (label.endsWith('%')) percentButtons.set(label, button);
    else if (label) balanceButton ??= button;
  }

  return {
    balanceButton,
    percentButtons,
    symbol: wrapper.previousElementSibling?.textContent?.trim() ?? '',
    input: requireElement(wrapper.querySelector('input'), 'the amount input'),
  };
}

function findSpan(within: Element, text: string): HTMLElement | undefined {
  return [...within.querySelectorAll('span')].find(
    (span) => span.textContent?.trim() === text,
  );
}

function findPriceInput(range: Element, label: string): HTMLInputElement {
  const heading = findSpan(range, label);
  return requireElement(
    heading && findNearby<HTMLInputElement>(heading, 'input', range),
    `the ${label} % input`,
  );
}

export function readPanel(form: HTMLFormElement): Panel {
  if (!form.isConnected) {
    throw new PresetError('The Create Position panel closed.');
  }

  const strategyButtons = new Map<string, HTMLButtonElement>();
  for (const button of form.querySelectorAll<HTMLButtonElement>(`${tour('strategy')} button`)) {
    // innerText, because these buttons contain <style> tags that pollute textContent.
    strategyButtons.set(button.innerText.trim(), button);
  }

  const range = requireElement(form.querySelector(tour('price-range')), 'the price range');
  // The only button in the range with a pair on it, such as "SOL/TOKEN", is the one that flips it.
  const pairButton = [...range.querySelectorAll('button')].find((button) =>
    button.innerText.includes('/'),
  );
  const autoFillLabel = requireElement(findSpan(form, 'Auto-Fill'), 'the Auto-Fill label');

  return {
    autoFillLabel,
    autoFillToggle: requireElement(
      findNearby<HTMLButtonElement>(autoFillLabel, 'button', form),
      'the Auto-Fill toggle',
    ),
    tokenX: readTokenField(form, 'x'),
    tokenY: readTokenField(form, 'y'),
    strategyButtons,
    minInput: findPriceInput(range, 'Min Price'),
    maxInput: findPriceInput(range, 'Max Price'),
    pairLabel: pairButton?.innerText.trim() ?? '',
  };
}

/** The pool's live price. It sits outside the Create Position form. */
export function readPoolPrice(): { value: number; pair: string } {
  // Its pair, such as "SOL/TOKEN", is the title of a label sitting directly in the button.
  const pair = [...document.querySelectorAll('button > span[title*="/"]')].find(isVisible);
  const button = requireElement(pair?.closest('button'), 'the current pool price');
  return {
    value: parsePrice(button.querySelector('span')?.textContent ?? ''),
    pair: button.querySelector('span[title]')?.getAttribute('title') ?? '',
  };
}

export const isAutoFillOn = (panel: Panel) =>
  panel.autoFillToggle.classList.contains('bg-primary');

export function isStrategySelected(panel: Panel, strategy: Strategy): boolean {
  const label = panel.strategyButtons.get(strategy)?.querySelector('span:last-child');
  return label?.classList.contains('text-v2-text-primary') ?? false;
}

export function readTotalBins(form: HTMLFormElement): number | null {
  const label = findSpan(form, 'Total Bins:');
  const text = label?.closest<HTMLElement>('.flex')?.innerText ?? '';
  const match = /Total Bins:\s*([\d,]+)/.exec(text);
  return match?.[1] ? Number(match[1].replace(/,/g, '')) : null;
}

export function readRange(form: HTMLFormElement, panel: Panel): RangeSnapshot {
  return {
    minPct: parseNumber(panel.minInput.value),
    maxPct: parseNumber(panel.maxInput.value),
    bins: readTotalBins(form),
  };
}
