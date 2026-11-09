export const STRATEGIES = ['Spot', 'Curve', 'Bid Ask'] as const;
export type Strategy = (typeof STRATEGIES)[number];

export type RangeSpec =
  | { mode: 'percent'; minPct: number }
  | { mode: 'bins'; bins: number };

export interface Preset {
  id: string;
  name?: string;
  sol: number;
  strategy: Strategy;
  autoFill: boolean;
  range: RangeSpec;
}

export const MIN_PCT_LIMIT = -99.99;

export const MAX_NAME_LENGTH = 40;

export function presetLabel(preset: Preset): string {
  return preset.name || presetDetails(preset);
}

export function presetDetails(preset: Preset): string {
  const range =
    preset.range.mode === 'percent'
      ? `${preset.range.minPct}%`
      : `${preset.range.bins} bins`;
  const autoFill = preset.autoFill ? ' | Auto-Fill' : '';
  return `${preset.sol} SOL | ${preset.strategy} | ${range}${autoFill}`;
}

/** Returns a message for the first invalid field, or null when the preset is valid. */
export function validatePreset(preset: Preset): string | null {
  if (!Number.isFinite(preset.sol) || preset.sol <= 0) {
    return 'SOL amount must be greater than 0.';
  }
  if (!STRATEGIES.includes(preset.strategy)) {
    return 'Choose a strategy.';
  }
  if (preset.range.mode === 'percent') {
    const { minPct } = preset.range;
    if (!Number.isFinite(minPct) || minPct >= 0 || minPct < MIN_PCT_LIMIT) {
      return `Min % must be between ${MIN_PCT_LIMIT} and 0, for example -74.`;
    }
  } else if (!Number.isInteger(preset.range.bins) || preset.range.bins < 2) {
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
}

/** Returns what differs between the panel and the preset, or null when they match. */
export function findMismatch(preset: Preset, state: PanelState): string | null {
  if (state.sol !== preset.sol) {
    return `The SOL amount no longer matches ${preset.sol}.`;
  }
  if (!state.strategySelected) {
    return `${preset.strategy} is no longer selected.`;
  }
  if (state.autoFillOn !== preset.autoFill) {
    return `Auto-Fill should be ${preset.autoFill ? 'on' : 'off'}.`;
  }
  // The toggle is read from a CSS class. A filled amount catches it being misread.
  if (!preset.autoFill && state.tokenAmount > 0) {
    return 'The token amount is filled, so this is not single-sided SOL. Check Auto-Fill.';
  }
  return null;
}

/** Parses Meteora's formatted field text, such as "-74.92%" or "1,250.5". */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/[%,\s]/g, '');
  return cleaned === '' ? Number.NaN : Number(cleaned);
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
