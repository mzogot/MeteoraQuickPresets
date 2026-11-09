import {
  PresetError,
  isAutoFillOn,
  isStrategySelected,
  readPanel,
  readRange,
  type Panel,
  type RangeSnapshot,
} from './dom';
import { typeAndCommit, waitFor, waitForQuiet } from './input';
import {
  MIN_PCT_LIMIT,
  amountMatches,
  deriveBinStepBps,
  findMismatch,
  isSolLogo,
  maxPctForBins,
  minPctForBins,
  oneBinPct,
  parseBalance,
  parseNumber,
  tokenAmountFor,
  type Preset,
  type SolPreset,
  type TokenPreset,
} from './presets';

// Must stay above the 300 ms debounce Meteora uses to snap the range after an amount edit.
const QUIET_MS = 400;
const QUIET_TIMEOUT_MS = 3000;
const STATE_TIMEOUT_MS = 2000;
const LOAD_TIMEOUT_MS = 5000;
const UNKNOWN_BIN_TOLERANCE_PCT = 2;
const ROUNDING_TOLERANCE_PCT = 0.02;
const MAX_RANGE_ATTEMPTS = 2;
const PARTIAL_FILL_NOTE = 'The panel may be only partly filled, so check it before creating.';

const rangeNotReady = (range: RangeSnapshot) =>
  !Number.isFinite(range.minPct) || !Number.isFinite(range.maxPct);

const describeRange = (now: RangeSnapshot) =>
  `${now.minPct}% to ${now.maxPct}%, ${now.bins ?? '?'} bins`;

const readTokenBalance = (current: Panel) =>
  parseBalance(current.tokenX.balanceButton?.innerText ?? '');

/** Read-only, so a token preset with nothing to deposit never touches the panel. */
function checkTokenBalance(current: Panel): void {
  if (current.tokenX.input.disabled) {
    throw new PresetError('The panel is locked right now. Try again in a moment.');
  }
  const balance = readTokenBalance(current);
  if (Number.isNaN(balance)) {
    throw new PresetError(`Couldn't read your ${current.tokenX.symbol} balance. Check your wallet is connected.`);
  }
  if (balance <= 0) {
    throw new PresetError(`This wallet has no ${current.tokenX.symbol} to deposit.`);
  }
}

function checkPool(panel: Panel): void {
  if (panel.tokenY.symbol !== 'SOL') {
    throw new PresetError(
      `Presets need a TOKEN/SOL pool. This one is ${panel.tokenX.symbol}/${panel.tokenY.symbol}.`,
    );
  }
  if (!isSolLogo(panel.tokenY.logoUrl)) {
    throw new PresetError("Couldn't confirm this pool uses real SOL. Its token may only be named SOL.");
  }
  const expected = `${panel.tokenY.symbol}/${panel.tokenX.symbol}`;
  if (panel.pairLabel !== expected) {
    throw new PresetError(
      `The price is flipped to ${panel.pairLabel}. Click it to switch back to ${expected}, then try again.`,
    );
  }
  if (panel.minInput.disabled || panel.tokenY.input.disabled) {
    throw new PresetError('The panel is locked right now. Try again in a moment.');
  }
}

export async function applyPreset(
  form: HTMLFormElement,
  preset: Preset,
  signal: AbortSignal,
  onStep: (message: string) => void,
): Promise<string> {
  const panel = () => readPanel(form);
  const range = () => readRange(form, panel());
  const settle = () => {
    const read = () => {
      const current = panel();
      return [
        current.minInput.value,
        current.maxInput.value,
        range().bins,
        current.tokenX.input.value,
        current.tokenY.input.value,
      ].join('|');
    };
    return waitForQuiet(read, QUIET_MS, QUIET_TIMEOUT_MS, signal);
  };

  onStep('Checking the panel…');
  const loaded = await waitFor(() => !rangeNotReady(range()), LOAD_TIMEOUT_MS, signal);
  if (!loaded) throw new PresetError('The price range has not loaded yet.');
  checkPool(panel());
  if (preset.side === 'token') checkTokenBalance(panel());

  // Everything above only reads the panel. From here on, a failure can leave it part-filled.
  try {
    await setAutoFill(preset.autoFill, panel, signal, onStep);
    if (preset.side === 'token') await setTokenAmount(preset, panel, settle, signal, onStep);
    else await setAmounts(preset, panel, settle, signal, onStep);

    onStep(`Selecting ${preset.strategy}…`);
    await setStrategy(preset, panel, signal);

    onStep('Setting the price range…');
    const summary =
      preset.side === 'token'
        ? await setTokenRange(preset, panel, range, settle, signal)
        : await setRange(preset, panel, range, settle, signal);
    verifyPanel(preset, panel());
    return summary;
  } catch (error) {
    if (error instanceof PresetError) {
      throw new PresetError(`${error.message} ${PARTIAL_FILL_NOTE}`);
    }
    throw error;
  }
}

function verifyPanel(preset: Preset, current: Panel): void {
  const mismatch = findMismatch(preset, {
    sol: parseNumber(current.tokenY.input.value),
    strategySelected: isStrategySelected(current, preset.strategy),
    autoFillOn: isAutoFillOn(current),
    tokenAmount: parseNumber(current.tokenX.input.value),
    tokenBalance: readTokenBalance(current),
  });
  if (mismatch) throw new PresetError(mismatch);
}

async function setAutoFill(
  wanted: boolean,
  panel: () => Panel,
  signal: AbortSignal,
  onStep: (message: string) => void,
): Promise<void> {
  // First on purpose: switching Auto-Fill on resets the price range.
  if (isAutoFillOn(panel()) === wanted) return;
  if (panel().autoFillToggle.disabled) {
    throw new PresetError(`Auto-Fill can't be turned ${wanted ? 'on' : 'off'} on this pool right now.`);
  }
  onStep(`Turning Auto-Fill ${wanted ? 'on' : 'off'}…`);
  panel().autoFillLabel.click();
  const changed = await waitFor(() => isAutoFillOn(panel()) === wanted, STATE_TIMEOUT_MS, signal);
  if (!changed) throw new PresetError('Auto-Fill did not change.');
}

async function setTokenAmount(
  preset: TokenPreset,
  panel: () => Panel,
  settle: () => Promise<void>,
  signal: AbortSignal,
  onStep: (message: string) => void,
): Promise<void> {
  const { tokenPct } = preset;
  onStep(`Entering ${tokenPct}% of your ${panel().tokenX.symbol}…`);

  // With Auto-Fill off, two non-zero amounts make Meteora reset the range.
  const { tokenY } = panel();
  if (!tokenY.input.disabled && parseNumber(tokenY.input.value) > 0) {
    await typeAndCommit(tokenY.input, '', signal);
  }

  const balance = readTokenBalance(panel());
  const tokenInput = () => panel().tokenX.input;
  const applied = () =>
    amountMatches(parseNumber(tokenInput().value), (balance * tokenPct) / 100);
  if (!applied()) {
    // Meteora's own controls know the unrounded balance, so prefer them to typing.
    const { percentButtons, balanceButton } = panel().tokenX;
    const shortcut =
      percentButtons.get(`${tokenPct}%`) ?? (tokenPct === 100 ? balanceButton : null);
    shortcut?.click();
    if (!shortcut || !(await waitFor(applied, STATE_TIMEOUT_MS, signal))) {
      await typeAndCommit(tokenInput(), String(tokenAmountFor(balance, tokenPct)), signal);
      if (!(await waitFor(applied, STATE_TIMEOUT_MS, signal))) {
        throw new PresetError('The token amount did not apply.');
      }
    }
  }
  await settle();
}

async function setAmounts(
  preset: SolPreset,
  panel: () => Panel,
  settle: () => Promise<void>,
  signal: AbortSignal,
  onStep: (message: string) => void,
): Promise<void> {
  onStep(`Entering ${preset.sol} SOL…`);
  const { tokenX } = panel();
  // With Auto-Fill off, two non-zero amounts make Meteora reset the range.
  if (!preset.autoFill && !tokenX.input.disabled && parseNumber(tokenX.input.value) > 0) {
    await typeAndCommit(tokenX.input, '', signal);
  }

  const solInput = () => panel().tokenY.input;
  if (parseNumber(solInput().value) !== preset.sol) {
    await typeAndCommit(solInput(), String(preset.sol), signal);
    const entered = await waitFor(
      () => parseNumber(solInput().value) === preset.sol,
      STATE_TIMEOUT_MS,
      signal,
    );
    if (!entered) throw new PresetError('The SOL amount did not apply.');
  }
  await settle();
}

async function setStrategy(
  preset: Preset,
  panel: () => Panel,
  signal: AbortSignal,
): Promise<void> {
  if (isStrategySelected(panel(), preset.strategy)) return;
  const button = panel().strategyButtons.get(preset.strategy);
  if (!button) throw new PresetError(`Couldn't find the ${preset.strategy} button.`);
  button.click();
  const selected = await waitFor(
    () => isStrategySelected(panel(), preset.strategy),
    STATE_TIMEOUT_MS,
    signal,
  );
  if (!selected) throw new PresetError(`${preset.strategy} did not select.`);
}

/** Token-only liquidity sits above the price, so Min stays at it and Max is what varies. */
async function setTokenRange(
  preset: TokenPreset,
  panel: () => Panel,
  range: () => RangeSnapshot,
  settle: () => Promise<void>,
  signal: AbortSignal,
): Promise<string> {
  const start = range();
  const binStep = deriveBinStepBps(start.minPct, start.maxPct, start.bins);
  const spec = preset.range;
  if (spec.mode === 'bins' && binStep === null) {
    throw new PresetError("Couldn't work out this pool's bin step from the panel.");
  }

  const toleranceAt = (pct: number) =>
    binStep === null ? UNKNOWN_BIN_TOLERANCE_PCT : oneBinPct(pct, binStep) + ROUNDING_TOLERANCE_PCT;

  let target = spec.mode === 'bins' ? maxPctForBins(0, spec.bins, binStep!) : spec.maxPct;

  for (let attempt = 1; ; attempt++) {
    // Max goes first: on a SOL-side range Max is about 0, so Min can't move up to it yet.
    await typeAndCommit(panel().maxInput, target.toFixed(2), signal);
    await settle();
    if (Math.abs(range().minPct) > toleranceAt(0)) {
      await typeAndCommit(panel().minInput, '0', signal);
      await settle();
    }

    const now = range();
    if (Math.abs(now.minPct) > toleranceAt(0)) {
      throw new PresetError(`Min should be at the current price but got ${describeRange(now)}.`);
    }
    if (spec.mode === 'bins') {
      if (now.bins === spec.bins) return `Ready: ${describeRange(now)}. Review, then create.`;
      if (attempt >= MAX_RANGE_ATTEMPTS || now.bins === null) {
        throw new PresetError(`Wanted ${spec.bins} bins but got ${describeRange(now)}.`);
      }
      target -= (now.bins - spec.bins) * oneBinPct(target, binStep!);
      continue;
    }

    if (Math.abs(now.maxPct - target) <= toleranceAt(target)) {
      return `Ready: ${describeRange(now)}. Review, then create.`;
    }
    if (attempt >= MAX_RANGE_ATTEMPTS) {
      throw new PresetError(`Wanted Max ${target}% but got ${describeRange(now)}.`);
    }
  }
}

async function setRange(
  preset: SolPreset,
  panel: () => Panel,
  range: () => RangeSnapshot,
  settle: () => Promise<void>,
  signal: AbortSignal,
): Promise<string> {
  const start = range();
  const binStep = deriveBinStepBps(start.minPct, start.maxPct, start.bins);
  if (preset.range.mode === 'bins' && binStep === null) {
    throw new PresetError("Couldn't work out this pool's bin step from the panel.");
  }

  let target =
    preset.range.mode === 'percent'
      ? preset.range.minPct
      : minPctForBins(start.maxPct, preset.range.bins, binStep!);

  for (let attempt = 1; ; attempt++) {
    const { maxPct } = range();
    if (target < MIN_PCT_LIMIT) {
      throw new PresetError('That many bins would go past the lowest allowed Min price.');
    }
    if (target >= maxPct) {
      throw new PresetError(`Min (${target.toFixed(2)}%) must be below Max (${maxPct}%).`);
    }

    await typeAndCommit(panel().minInput, target.toFixed(2), signal);
    await settle();

    const now = range();
    if (preset.range.mode === 'bins') {
      if (now.bins === preset.range.bins) return `Ready: ${describeRange(now)}. Review, then create.`;
      if (attempt >= MAX_RANGE_ATTEMPTS || now.bins === null) {
        throw new PresetError(`Wanted ${preset.range.bins} bins but got ${describeRange(now)}.`);
      }
      target += (now.bins - preset.range.bins) * oneBinPct(target, binStep!);
      continue;
    }

    const tolerance =
      binStep === null
        ? UNKNOWN_BIN_TOLERANCE_PCT
        : oneBinPct(target, binStep) + ROUNDING_TOLERANCE_PCT;
    if (Math.abs(now.minPct - target) <= tolerance) {
      return `Ready: ${describeRange(now)}. Review, then create.`;
    }
    if (attempt >= MAX_RANGE_ATTEMPTS) {
      throw new PresetError(`Wanted Min ${target}% but got ${describeRange(now)}.`);
    }
  }
}
