import { PresetError } from './dom';
import { SOL_MINT, poolAddressFromPath, quoteMintFromPool } from './presets';

const POOL_API = 'https://dlmm.datapi.meteora.ag/pools/';
const TIMEOUT_MS = 8000;
const UNREACHABLE = "Couldn't check this pool with Meteora. Try again in a moment.";

// A pool's tokens never change, so one answer per pool lasts the page's lifetime.
const quoteMints = new Map<string, string>();

async function fetchQuoteMint(address: string, signal: AbortSignal): Promise<string> {
  let data: unknown;
  try {
    // The extension's only network request. It sends the pool address and nothing else.
    const response = await fetch(POOL_API + address, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch {
    // An abort carries the reason to show, such as the user reaching into the panel.
    if (signal.aborted) throw signal.reason;
    throw new PresetError(UNREACHABLE);
  }
  const mint = quoteMintFromPool(data, address);
  if (!mint) throw new PresetError(UNREACHABLE);
  return mint;
}

/**
 * Token symbols and logos are free text, and fake "SOL" tokens exist. The mint
 * is the only proof, and Meteora's page doesn't show it, so ask Meteora's pool API.
 */
export async function confirmRealSol(signal: AbortSignal): Promise<void> {
  const address = poolAddressFromPath(location.pathname);
  if (!address) {
    throw new PresetError("Couldn't tell which pool this is from the page address.");
  }
  let mint = quoteMints.get(address);
  if (!mint) {
    mint = await fetchQuoteMint(address, signal);
    quoteMints.set(address, mint);
  }
  if (mint !== SOL_MINT) {
    throw new PresetError("This pool doesn't use real SOL. Its token is only named SOL.");
  }
}
