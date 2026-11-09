import { PresetError, findCreateForm } from './dom';
import type { Preset } from './presets';
import { applyPreset } from './runner';
import { loadPresets, onPresetsChanged, savePresets } from './storage';
import { PresetBar } from './ui';

const SYNC_DELAY_MS = 150;

let presets: Preset[] = [];
let activeRun: AbortController | null = null;
let lastUrl = location.href;

const bar = new PresetBar({
  onApply: (preset) => void runPreset(preset),
  onSave: (preset) => {
    const exists = presets.some((item) => item.id === preset.id);
    void persist(
      exists
        ? presets.map((item) => (item.id === preset.id ? preset : item))
        : [...presets, preset],
    );
  },
  onDelete: (id) => void persist(presets.filter((item) => item.id !== id)),
});

async function persist(next: Preset[]): Promise<void> {
  presets = next;
  bar.setPresets(next);
  try {
    await savePresets(next);
  } catch {
    bar.setStatus("Couldn't save. Reload the page and try again.", 'error');
  }
}

async function runPreset(preset: Preset): Promise<void> {
  const form = findCreateForm();
  if (activeRun || !form) return;

  const controller = new AbortController();
  activeRun = controller;
  bar.setBusy(true);

  // The user reaching into the panel always wins over a run in progress.
  const stopOnUserAction = (event: Event) => {
    if (event.isTrusted) {
      controller.abort(new PresetError('Stopped because you used the panel.'));
    }
  };
  form.addEventListener('pointerdown', stopOnUserAction, true);
  form.addEventListener('keydown', stopOnUserAction, true);

  try {
    const summary = await applyPreset(form, preset, controller.signal, (step) =>
      bar.setStatus(step, 'busy'),
    );
    bar.setStatus(summary, 'ok');
  } catch (error) {
    const message =
      error instanceof PresetError ? error.message : 'Something went wrong. Check the panel.';
    bar.setStatus(message, 'error');
    if (!(error instanceof PresetError)) console.error('[Quick Presets]', error);
  } finally {
    form.removeEventListener('pointerdown', stopOnUserAction, true);
    form.removeEventListener('keydown', stopOnUserAction, true);
    activeRun = null;
    bar.setBusy(false);
  }
}

function sync(): void {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    activeRun?.abort(new PresetError('Stopped because the page changed.'));
    bar.setStatus('', 'idle');
  }

  const form = findCreateForm();
  if (!form) {
    bar.host.remove();
  } else if (bar.host.nextElementSibling !== form) {
    // Outside the form, so nothing in the bar can ever submit it.
    form.before(bar.host);
  }
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync(): void {
  syncTimer ??= setTimeout(() => {
    syncTimer = undefined;
    sync();
  }, SYNC_DELAY_MS);
}

async function start(): Promise<void> {
  presets = await loadPresets();
  bar.setPresets(presets);
  onPresetsChanged((next) => {
    presets = next;
    bar.setPresets(next);
  });
  new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
  sync();
}

void start();
