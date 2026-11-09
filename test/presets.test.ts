import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deriveBinStepBps,
  findMismatch,
  isSolLogo,
  maxPctForBins,
  minPctForBins,
  parseBalance,
  parseNumber,
  presetDetails,
  presetLabel,
  tokenAmountFor,
  validatePreset,
  type Preset,
  type TokenPreset,
} from '../src/presets.ts';

const preset: Preset = {
  id: 'a',
  sol: 2,
  strategy: 'Bid Ask',
  autoFill: false,
  range: { mode: 'percent', minPct: -74 },
};

test('parses formatted field text', () => {
  assert.equal(parseNumber('-74.92%'), -74.92);
  assert.equal(parseNumber('1,250.5'), 1250.5);
  assert.equal(parseNumber('-0.00%'), -0);
  assert.ok(Number.isNaN(parseNumber('')));
});

test('derives bin step from values seen on live pools', () => {
  assert.equal(deriveBinStepBps(-49.67, -0, 70), 100);
  assert.equal(deriveBinStepBps(-15.6, 18.48, 69), 50);
});

test('cannot derive a bin step without a usable range', () => {
  assert.equal(deriveBinStepBps(-10, 0, 1), null);
  assert.equal(deriveBinStepBps(-10, 0, null), null);
  assert.equal(deriveBinStepBps(0, 0, 70), null);
});

test('computes Min % for a bin count, a quarter-bin above the edge', () => {
  const min = minPctForBins(0, 70, 100);
  const edge = (Math.pow(1.01, -69) - 1) * 100;
  assert.ok(min > edge && min - edge < 0.25);
});

test('builds the label', () => {
  assert.equal(presetLabel(preset), '2 SOL | Bid Ask | -74%');
  assert.equal(
    presetLabel({ ...preset, autoFill: true, range: { mode: 'bins', bins: 69 } }),
    '2 SOL | Bid Ask | 69 bins | Auto-Fill',
  );
});

test('a name replaces the label but not the details', () => {
  const named = { ...preset, name: 'Dip catcher' };
  assert.equal(presetLabel(named), 'Dip catcher');
  assert.equal(presetDetails(named), '2 SOL | Bid Ask | -74%');
});

test('recognises real SOL by the logo URLs seen on live pools', () => {
  assert.ok(
    isSolLogo(
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    ),
  );
  assert.equal(isSolLogo('https://file.dexlab.space/file/000fd806c78a47a29a0d581b4d10fdf7'), false);
  assert.equal(isSolLogo('https://gateway.pinata.cloud/ipfs/bafybeihijocwf7ykrywjzwdubxx'), false);
  assert.equal(isSolLogo(''), false);
});

test('finds nothing wrong when the panel matches the preset', () => {
  const state = { sol: 2, strategySelected: true, autoFillOn: false, tokenAmount: Number.NaN, tokenBalance: 0 };
  assert.equal(findMismatch(preset, state), null);
  assert.equal(findMismatch(preset, { ...state, tokenAmount: 0 }), null);
  assert.equal(
    findMismatch({ ...preset, autoFill: true }, { ...state, autoFillOn: true, tokenAmount: 5 }),
    null,
  );
});

test('reports a panel that differs from the preset', () => {
  const state = { sol: 2, strategySelected: true, autoFillOn: false, tokenAmount: 0, tokenBalance: 0 };
  assert.match(findMismatch(preset, { ...state, sol: 1.5 })!, /SOL amount/);
  assert.match(findMismatch(preset, { ...state, sol: Number.NaN })!, /SOL amount/);
  assert.match(findMismatch(preset, { ...state, strategySelected: false })!, /Bid Ask/);
  assert.match(findMismatch(preset, { ...state, autoFillOn: true })!, /Auto-Fill/);
});

test('catches Auto-Fill being on when its toggle reads as off', () => {
  const state = { sol: 2, strategySelected: true, autoFillOn: false, tokenAmount: 1234, tokenBalance: 0 };
  assert.match(findMismatch(preset, state)!, /single-sided/);
});

const tokenPreset: TokenPreset = {
  id: 'b',
  side: 'token',
  tokenPct: 50,
  strategy: 'Spot',
  autoFill: false,
  range: { mode: 'maxPercent', maxPct: 100 },
};

test('builds the label for token-sided presets', () => {
  assert.equal(presetLabel(tokenPreset), '50% Token | Spot | +100%');
  assert.equal(
    presetDetails({ ...tokenPreset, tokenPct: 33, range: { mode: 'bins', bins: 69 } }),
    '33% Token | Spot | 69 bins',
  );
});

test('validates token-sided presets', () => {
  assert.equal(validatePreset(tokenPreset), null);
  assert.equal(validatePreset({ ...tokenPreset, tokenPct: 100 }), null);
  assert.match(validatePreset({ ...tokenPreset, tokenPct: 0 })!, /Token %/);
  assert.match(validatePreset({ ...tokenPreset, tokenPct: 101 })!, /Token %/);
  assert.match(validatePreset({ ...tokenPreset, tokenPct: Number.NaN })!, /Token %/);
  assert.match(validatePreset({ ...tokenPreset, range: { mode: 'maxPercent', maxPct: -5 } })!, /Max %/);
});

test('still accepts presets saved before the side existed', () => {
  assert.equal(preset.side, undefined);
  assert.equal(validatePreset(preset), null);
});

test('parses wallet balances, including shortened ones', () => {
  assert.equal(parseBalance('0.27142'), 0.27142);
  assert.equal(parseBalance('1,250.5'), 1250.5);
  assert.equal(parseBalance('4.94M'), 4_940_000);
  assert.equal(parseBalance('12k'), 12_000);
  assert.equal(parseBalance('0'), 0);
  assert.ok(Number.isNaN(parseBalance('')));
  assert.ok(Number.isNaN(parseBalance('<0.001')));
});

test('rounds a typed token amount down so it cannot exceed the balance', () => {
  assert.equal(tokenAmountFor(1000, 33), 330);
  assert.equal(tokenAmountFor(0.0000019, 100), 0.000001);
});

test('checks a token-sided panel against the balance', () => {
  const state = { sol: Number.NaN, strategySelected: true, autoFillOn: false, tokenAmount: 500, tokenBalance: 1000 };
  assert.equal(findMismatch(tokenPreset, state), null);
  assert.equal(findMismatch(tokenPreset, { ...state, sol: 0 }), null);
  assert.match(findMismatch(tokenPreset, { ...state, tokenAmount: 250 })!, /50% of your balance/);
  assert.match(findMismatch(tokenPreset, { ...state, tokenAmount: Number.NaN })!, /50% of your balance/);
  assert.match(findMismatch(tokenPreset, { ...state, sol: 1 })!, /single-sided token/);
  assert.match(findMismatch(tokenPreset, { ...state, autoFillOn: true })!, /Auto-Fill/);
});

test('computes Max % for a bin count, a quarter-bin above the edge', () => {
  const max = maxPctForBins(0, 70, 100);
  const edge = (Math.pow(1.01, 69) - 1) * 100;
  assert.ok(max > edge && max - edge < 0.5);
});

test('validates presets', () => {
  assert.equal(validatePreset(preset), null);
  assert.match(validatePreset({ ...preset, sol: 0 })!, /SOL amount/);
  assert.match(validatePreset({ ...preset, sol: Number.NaN })!, /SOL amount/);
  assert.match(validatePreset({ ...preset, range: { mode: 'percent', minPct: 5 } })!, /Min %/);
  assert.match(validatePreset({ ...preset, range: { mode: 'bins', bins: 1.5 } })!, /Total bins/);
});
