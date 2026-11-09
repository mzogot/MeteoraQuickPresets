import {
  MAX_NAME_LENGTH,
  STRATEGIES,
  presetDetails,
  presetLabel,
  validatePreset,
  type Preset,
  type Strategy,
} from './presets';

export type StatusKind = 'idle' | 'busy' | 'ok' | 'error';

export interface BarHandlers {
  onApply(preset: Preset): void;
  onSave(preset: Preset): void;
  onDelete(id: string): void;
}

const CSS = `
  :host { all: initial; display: block; padding: 12px 16px 0; font: 500 12px/1.4 system-ui, sans-serif; color: #f1f1f4; }
  * { box-sizing: border-box; font: inherit; }
  [hidden] { display: none !important; }
  .bar { background: #1a1a24; border: 1px solid #2e2e3c; border-radius: 10px; padding: 10px; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  h2 { margin: 0; font-size: 13px; font-weight: 600; }
  button { cursor: pointer; border: 0; color: inherit; background: none; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #f5a24b; outline-offset: 1px; }
  button:disabled { cursor: not-allowed; opacity: .5; }
  .add { color: #f5a24b; font-weight: 600; padding: 4px 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; background: #262633; border: 1px solid #383848; border-radius: 8px; overflow: hidden; }
  .chip:hover { border-color: #f5a24b; }
  .apply { padding: 7px 8px; text-align: left; overflow-wrap: anywhere; }
  .edit { padding: 7px 8px; color: #a3a3b5; border-left: 1px solid #383848; }
  .empty { margin: 0; color: #a3a3b5; }
  .status { margin: 8px 0 0; color: #a3a3b5; overflow-wrap: anywhere; }
  .status.ok { color: #5fd38d; }
  .status.error { color: #ff8585; }
  .editor { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #2e2e3c; }
  label { display: flex; flex-direction: column; gap: 3px; color: #a3a3b5; }
  input, select { width: 100%; min-height: 30px; padding: 5px 7px; color: #f1f1f4; background: #101018; border: 1px solid #383848; border-radius: 6px; }
  .full { grid-column: 1 / -1; }
  .check { flex-direction: row; align-items: center; gap: 6px; grid-column: 1 / -1; color: #f1f1f4; }
  .check input { width: 14px; min-height: 14px; }
  .error-text { grid-column: 1 / -1; margin: 0; color: #ff8585; }
  .actions { grid-column: 1 / -1; display: flex; gap: 6px; }
  .actions button { padding: 6px 12px; border-radius: 6px; background: #262633; }
  .actions .save { background: #f5a24b; color: #1a1206; font-weight: 600; }
  .actions .delete { margin-left: auto; color: #ff8585; }
`;

const TEMPLATE = `
  <style>${CSS}</style>
  <section class="bar" aria-label="Quick Presets">
    <header>
      <h2>Quick Presets</h2>
      <button class="add" type="button">+ Add</button>
    </header>
    <div class="chips"></div>
    <p class="status" role="status" hidden></p>
    <div class="editor" hidden>
      <label class="full">Name (optional)<input class="f-name" maxlength="${MAX_NAME_LENGTH}" autocomplete="off"></label>
      <label>SOL amount<input class="f-sol" inputmode="decimal" autocomplete="off"></label>
      <label>Strategy<select class="f-strategy"></select></label>
      <label>Range type
        <select class="f-mode">
          <option value="percent">Min %</option>
          <option value="bins">Total bins</option>
        </select>
      </label>
      <label><span class="f-value-label">Min %</span><input class="f-value" inputmode="decimal" autocomplete="off"></label>
      <label class="check"><input class="f-autofill" type="checkbox">Keep Auto-Fill on (off = single-sided SOL)</label>
      <p class="error-text" role="alert" hidden></p>
      <div class="actions">
        <button class="save" type="button">Save</button>
        <button class="cancel" type="button">Cancel</button>
        <button class="delete" type="button">Delete</button>
      </div>
    </div>
  </section>
`;

export class PresetBar {
  readonly host = document.createElement('div');
  private readonly root = this.host.attachShadow({ mode: 'closed' });
  private presets: Preset[] = [];
  private busy = false;
  private editingId: string | null = null;

  constructor(private readonly handlers: BarHandlers) {
    this.root.innerHTML = TEMPLATE;
    for (const strategy of STRATEGIES) {
      this.strategyField.add(new Option(strategy, strategy));
    }

    // Keep typing and clicks here from reaching Meteora's own handlers.
    for (const type of ['keydown', 'keyup', 'keypress', 'click']) {
      this.host.addEventListener(type, (event) => event.stopPropagation());
    }

    this.get('.add').addEventListener('click', () => this.openEditor(null));
    this.get('.cancel').addEventListener('click', () => this.closeEditor());
    this.get('.save').addEventListener('click', () => this.save());
    this.get('.delete').addEventListener('click', () => {
      if (this.editingId) this.handlers.onDelete(this.editingId);
      this.closeEditor();
    });
    this.modeField.addEventListener('change', () => this.syncModeLabel());
  }

  private get<T extends HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector)!;
  }

  private get nameField() { return this.get<HTMLInputElement>('.f-name'); }
  private get solField() { return this.get<HTMLInputElement>('.f-sol'); }
  private get strategyField() { return this.get<HTMLSelectElement>('.f-strategy'); }
  private get modeField() { return this.get<HTMLSelectElement>('.f-mode'); }
  private get valueField() { return this.get<HTMLInputElement>('.f-value'); }
  private get autoFillField() { return this.get<HTMLInputElement>('.f-autofill'); }

  setPresets(presets: Preset[]): void {
    this.presets = presets;
    this.renderChips();
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.renderChips();
  }

  setStatus(message: string, kind: StatusKind): void {
    const status = this.get('.status');
    status.textContent = message;
    status.className = `status ${kind}`;
    status.hidden = message === '';
  }

  private renderChips(): void {
    const chips = this.get('.chips');
    chips.replaceChildren();
    if (this.presets.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No presets yet. Add one to get started.';
      chips.append(empty);
      return;
    }
    for (const preset of this.presets) {
      const label = presetLabel(preset);
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'apply';
      apply.textContent = label;
      apply.title = presetDetails(preset);
      apply.disabled = this.busy;
      apply.addEventListener('click', () => this.handlers.onApply(preset));

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'edit';
      edit.textContent = '✎';
      edit.title = 'Edit';
      edit.setAttribute('aria-label', `Edit ${label}`);
      edit.addEventListener('click', () => this.openEditor(preset));

      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.append(apply, edit);
      chips.append(chip);
    }
  }

  private openEditor(preset: Preset | null): void {
    this.editingId = preset?.id ?? null;
    this.nameField.value = preset?.name ?? '';
    this.solField.value = preset ? String(preset.sol) : '';
    this.strategyField.value = preset?.strategy ?? 'Bid Ask';
    this.modeField.value = preset?.range.mode ?? 'percent';
    this.valueField.value = !preset
      ? ''
      : String(preset.range.mode === 'percent' ? preset.range.minPct : preset.range.bins);
    this.autoFillField.checked = preset?.autoFill ?? false;
    this.showEditorError('');
    this.syncModeLabel();
    this.get('.delete').hidden = preset === null;
    this.get('.editor').hidden = false;
    this.nameField.focus();
  }

  private closeEditor(): void {
    this.editingId = null;
    this.get('.editor').hidden = true;
  }

  private syncModeLabel(): void {
    this.get('.f-value-label').textContent =
      this.modeField.value === 'percent' ? 'Min %' : 'Total bins';
  }

  private showEditorError(message: string): void {
    const error = this.get('.error-text');
    error.textContent = message;
    error.hidden = message === '';
  }

  private save(): void {
    const value = Number(this.valueField.value.trim() || Number.NaN);
    const name = this.nameField.value.trim();
    const preset: Preset = {
      id: this.editingId ?? crypto.randomUUID(),
      ...(name ? { name } : {}),
      sol: Number(this.solField.value.trim() || Number.NaN),
      strategy: this.strategyField.value as Strategy,
      autoFill: this.autoFillField.checked,
      range:
        this.modeField.value === 'percent'
          ? { mode: 'percent', minPct: value }
          : { mode: 'bins', bins: value },
    };
    const problem = validatePreset(preset);
    if (problem) {
      this.showEditorError(problem);
      return;
    }
    this.handlers.onSave(preset);
    this.closeEditor();
  }
}
