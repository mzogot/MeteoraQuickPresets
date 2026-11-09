import { parseNumber, type Strategy } from './presets';

/** A failure with a message written to be shown to the user. */
export class PresetError extends Error {}

const component = (name: string) => `[data-sentry-component="${name}"]`;

export interface TokenField {
  symbol: string;
  logoUrl: string;
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

/** The Create Position form, excluding the add-liquidity form on existing positions. */
export function findCreateForm(): HTMLFormElement | null {
  for (const amount of document.querySelectorAll(component('AmountInput'))) {
    if (!isVisible(amount)) continue;
    if (amount.closest(component('PositionManagementAddLiquidityComponent'))) continue;
    const form = amount.closest('form');
    if (
      form?.querySelector(component('StrategySelection')) &&
      form.querySelectorAll(component('BinPriceInput')).length >= 2
    ) {
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

/** The nearest balance row going up from the field, which is always the field's own. */
function findBalanceActions(wrapper: Element): Element | null {
  for (let node = wrapper.parentElement; node; node = node.parentElement) {
    const actions = node.querySelector(component('TokenBalanceActions'));
    if (actions) return actions;
  }
  return null;
}

function readTokenField(form: HTMLFormElement, side: 'x' | 'y'): TokenField {
  const wrapper = requireElement(
    form.querySelector(`[data-tour="amount-input-${side}"]`),
    `the token ${side.toUpperCase()} field`,
  );

  let balanceButton: HTMLButtonElement | null = null;
  const percentButtons = new Map<string, HTMLButtonElement>();
  for (const button of findBalanceActions(wrapper)?.querySelectorAll('button') ?? []) {
    const label = button.innerText.trim();
    if (label.endsWith('%')) percentButtons.set(label, button);
    else if (label) balanceButton ??= button;
  }

  return {
    balanceButton,
    percentButtons,
    symbol: wrapper.previousElementSibling?.textContent?.trim() ?? '',
    logoUrl:
      wrapper.parentElement?.querySelector<HTMLImageElement>(`${component('TokenLogo')} img`)?.src ?? '',
    input: requireElement(wrapper.querySelector('input'), 'the amount input'),
  };
}

function findPriceInput(form: HTMLFormElement, label: string): HTMLInputElement {
  const block = [...form.querySelectorAll(component('BinPriceInput'))].find(
    (element) => element.querySelector('span')?.textContent?.trim() === label,
  );
  return requireElement(block?.querySelector('input'), `the ${label} % input`);
}

function findSpan(form: HTMLFormElement, text: string): HTMLElement | undefined {
  return [...form.querySelectorAll('span')].find(
    (span) => span.textContent?.trim() === text,
  );
}

export function readPanel(form: HTMLFormElement): Panel {
  if (!form.isConnected) {
    throw new PresetError('The Create Position panel closed.');
  }

  const strategyButtons = new Map<string, HTMLButtonElement>();
  for (const button of form.querySelectorAll<HTMLButtonElement>(
    `${component('StrategySelection')} button`,
  )) {
    // innerText, because these buttons contain <style> tags that pollute textContent.
    strategyButtons.set(button.innerText.trim(), button);
  }

  const range = requireElement(form.querySelector(component('PositionPriceRange')), 'the price range');
  const swapIcon = range.querySelector(component('SwapIcon'));

  return {
    autoFillLabel: requireElement(findSpan(form, 'Auto-Fill'), 'the Auto-Fill label'),
    autoFillToggle: requireElement(
      form.querySelector<HTMLButtonElement>(component('Toggle')),
      'the Auto-Fill toggle',
    ),
    tokenX: readTokenField(form, 'x'),
    tokenY: readTokenField(form, 'y'),
    strategyButtons,
    minInput: findPriceInput(form, 'Min Price'),
    maxInput: findPriceInput(form, 'Max Price'),
    pairLabel: swapIcon?.closest('button')?.innerText.trim() ?? '',
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
