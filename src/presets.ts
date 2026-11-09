export const STRATEGIES = ['Spot', 'Curve', 'Bid Ask'] as const;
export type Strategy = (typeof STRATEGIES)[number];

export type Side = 'sol' | 'token';

export type BinsRange = { mode: 'bins'; bins: number };
export type SolRange = { mode: 'percent'; minPct: number } | BinsRange;
export type TokenRange = { mode: 'maxPercent'; maxPct: number } | BinsRange;

interface PresetBase {
  id: string;
  name?: string;
  strategy: Strategy;
}

/** `side` is absent on presets saved before token-sided presets existed. */
export interface SolPreset extends PresetBase {
  side?: 'sol';
  sol: number;
  autoFill: boolean;
  range: SolRange;
}

/** Single-sided token: the liquidity sits above the current price. */
export interface TokenPreset extends PresetBase {
  side: 'token';
  tokenPct: number;
  autoFill: false;
  range: TokenRange;
}

export type Preset = SolPreset | TokenPreset;

export const MIN_PCT_LIMIT = -99.99;

export const TOKEN_PCT_SHORTCUTS = [25, 50, 100] as const;

export const MAX_NAME_LENGTH = 40;

export function presetLabel(preset: Preset): string {
  return preset.name || presetDetails(preset);
}

export function presetDetails(preset: Preset): string {
  const { range } = preset;
  const rangeText =
    range.mode === 'percent'
      ? `${range.minPct}%`
      : range.mode === 'maxPercent'
        ? `+${range.maxPct}%`
        : `${range.bins} bins`;
  const amount = preset.side === 'token' ? `${preset.tokenPct}% Token` : `${preset.sol} SOL`;
  const autoFill = preset.autoFill ? ' | Auto-Fill' : '';
  return `${amount} | ${preset.strategy} | ${rangeText}${autoFill}`;
}

/** Returns a message for the first invalid field, or null when the preset is valid. */
export function validatePreset(preset: Preset): string | null {
  if (preset.side === 'token') {
    const { tokenPct } = preset;
    if (!Number.isFinite(tokenPct) || tokenPct <= 0 || tokenPct > 100) {
      return 'Token % must be above 0 and at most 100.';
    }
  } else if (!Number.isFinite(preset.sol) || preset.sol <= 0) {
    return 'SOL amount must be greater than 0.';
  }
  if (!STRATEGIES.includes(preset.strategy)) {
    return 'Choose a strategy.';
  }
  const { range } = preset;
  if (range.mode === 'percent') {
    const { minPct } = range;
    if (!Number.isFinite(minPct) || minPct >= 0 || minPct < MIN_PCT_LIMIT) {
      return `Min % must be between ${MIN_PCT_LIMIT} and 0, for example -74.`;
    }
  } else if (range.mode === 'maxPercent') {
    if (!Number.isFinite(range.maxPct) || range.maxPct <= 0) {
      return 'Max % must be above 0, for example 100.';
    }
  } else if (!Number.isInteger(range.bins) || range.bins < 2) {
    return 'Total bins must be a whole number of at least 2.';
  }
  return null;
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Token symbols are free text, and fake "SOL" tokens exist. Meteora loads real
 * SOL's logo from a path containing its mint; fakes use their own logo.
 */
export const isSolLogo = (logoUrl: string) => logoUrl.includes(`/${SOL_MINT}/`);

export interface PanelState {
  sol: number;
  strategySelected: boolean;
  autoFillOn: boolean;
  tokenAmount: number;
  tokenBalance: number;
}

// Wide enough for a balance Meteora shortens, such as "4.94M".
const AMOUNT_TOLERANCE = 0.01;

/** False for NaN, so an empty or unreadable field never counts as a match. */
export function amountMatches(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= expected * AMOUNT_TOLERANCE;
}

/** The amount to type for a share of a balance, rounded down so it can't exceed it. */
export function tokenAmountFor(balance: number, pct: number): number {
  return Math.floor((balance * pct) / 100 * 1e6) / 1e6;
}

/** Returns what differs between the panel and the preset, or null when they match. */
export function findMismatch(preset: Preset, state: PanelState): string | null {
  if (preset.side === 'token') {
    if (!amountMatches(state.tokenAmount, (state.tokenBalance * preset.tokenPct) / 100)) {
      return `The token amount is not ${preset.tokenPct}% of your balance.`;
    }
    if (state.sol > 0) {
      return 'The SOL amount is filled, so this is not single-sided token. Check Auto-Fill.';
    }
  } else if (state.sol !== preset.sol) {
    return `The SOL amount no longer matches ${preset.sol}.`;
  }
  if (!state.strategySelected) {
    return `${preset.strategy} is no longer selected.`;
  }
  if (state.autoFillOn !== preset.autoFill) {
    return `Auto-Fill should be ${preset.autoFill ? 'on' : 'off'}.`;
  }
  // The toggle is read from a CSS class. A filled amount catches it being misread.
  if (preset.side !== 'token' && !preset.autoFill && state.tokenAmount > 0) {
    return 'The token amount is filled, so this is not single-sided SOL. Check Auto-Fill.';
  }
  return null;
}

/** Parses Meteora's formatted field text, such as "-74.92%" or "1,250.5". */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/[%,\s]/g, '');
  return cleaned === '' ? Number.NaN : Number(cleaned);
}

const BALANCE_SUFFIXES: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

/** Parses a wallet balance, such as "0.27142", "1,250.5" or "4.94M". NaN if unreadable. */
export function parseBalance(text: string): number {
  const match = /^([\d,.]+)\s*([KMBT])?$/i.exec(text.trim());
  if (!match?.[1]) return Number.NaN;
  return parseNumber(match[1]) * (BALANCE_SUFFIXES[match[2]?.toUpperCase() ?? ''] ?? 1);
}

/**
 * Works out a pool's bin step from what the panel already shows, since
 * maxPrice / minPrice = (1 + step) ^ (bins - 1).
 */
export function deriveBinStepBps(
  minPct: number,
  maxPct: number,
  bins: number | null,
): number | null {
  if (bins === null || bins < 2) return null;
  const ratio = (1 + maxPct / 100) / (1 + minPct / 100);
  if (!Number.isFinite(ratio) || ratio <= 1) return null;
  const bps = Math.round((Math.pow(ratio, 1 / (bins - 1)) - 1) * 10_000);
  return bps >= 1 ? bps : null;
}

/** Width of one bin, in percentage points, at the given price offset. */
export function oneBinPct(atPct: number, binStepBps: number): number {
  return (1 + atPct / 100) * (binStepBps / 100);
}

/**
 * Min % that yields `bins` total bins with the Max price left where it is.
 * Aims a quarter-bin above the boundary so rounding down lands on the intended bin.
 */
export function minPctForBins(
  maxPct: number,
  bins: number,
  binStepBps: number,
): number {
  const step = 1 + binStepBps / 10_000;
  const edge = (1 + maxPct / 100) * Math.pow(step, -(bins - 1));
  const aimed = edge * Math.pow(step, 0.25);
  return (aimed - 1) * 100;
}

/** Max % that yields `bins` total bins from the given Min, aiming the same quarter-bin up. */
export function maxPctForBins(
  minPct: number,
  bins: number,
  binStepBps: number,
): number {
  const step = 1 + binStepBps / 10_000;
  const edge = (1 + minPct / 100) * Math.pow(step, bins - 1);
  const aimed = edge * Math.pow(step, 0.25);
  return (aimed - 1) * 100;
}
