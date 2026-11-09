import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deriveBinStepBps,
  findMismatch,
  isSolLogo,
  minPctForBins,
  parseNumber,
  presetDetails,
  presetLabel,
  validatePreset,
  type Preset,
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
  const state = { sol: 2, strategySelected: true, autoFillOn: false, tokenAmount: Number.NaN };
  assert.equal(findMismatch(preset, state), null);
  assert.equal(findMismatch(preset, { ...state, tokenAmount: 0 }), null);
  assert.equal(
    findMismatch({ ...preset, autoFill: true }, { ...state, autoFillOn: true, tokenAmount: 5 }),
    null,
  );
});

test('reports a panel that differs from the preset', () => {
  const state = { sol: 2, strategySelected: true, autoFillOn: false, tokenAmount: 0 };
  assert.match(findMismatch(preset, { ...state, sol: 1.5 })!, /SOL amount/);
  assert.match(findMismatch(preset, { ...state, sol: Number.NaN })!, /SOL amount/);
  assert.match(findMismatch(preset, { ...state, strategySelected: false })!, /Bid Ask/);
  assert.match(findMismatch(preset, { ...state, autoFillOn: true })!, /Auto-Fill/);
});

test('catches Auto-Fill being on when its toggle reads as off', () => {
  const state = { sol: 2, strategySelected: true, autoFillOn: false, tokenAmount: 1234 };
  assert.match(findMismatch(preset, state)!, /single-sided/);
});

test('validates presets', () => {
  assert.equal(validatePreset(preset), null);
  assert.match(validatePreset({ ...preset, sol: 0 })!, /SOL amount/);
  assert.match(validatePreset({ ...preset, sol: Number.NaN })!, /SOL amount/);
  assert.match(validatePreset({ ...preset, range: { mode: 'percent', minPct: 5 } })!, /Min %/);
  assert.match(validatePreset({ ...preset, range: { mode: 'bins', bins: 1.5 } })!, /Total bins/);
});
