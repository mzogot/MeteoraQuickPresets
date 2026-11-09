import type { Preset } from './presets';

const KEY = 'presets.v1';

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'default-bid-ask',
    sol: 2,
    strategy: 'Bid Ask',
    autoFill: false,
    range: { mode: 'percent', minPct: -74 },
  },
];

export async function loadPresets(): Promise<Preset[]> {
  const stored = await chrome.storage.local.get(KEY);
  const presets = stored[KEY] as Preset[] | undefined;
  if (presets) return presets;
  await savePresets(DEFAULT_PRESETS);
  return DEFAULT_PRESETS;
}

export function savePresets(presets: Preset[]): Promise<void> {
  return chrome.storage.local.set({ [KEY]: presets });
}

/** Keeps every open Meteora tab showing the same presets. */
export function onPresetsChanged(listener: (presets: Preset[]) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    const change = changes[KEY];
    if (area === 'local' && change) listener((change.newValue ?? []) as Preset[]);
  });
}
