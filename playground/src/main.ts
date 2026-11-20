import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { ResumeData, Size, Template } from '@resume/types';
import * as initialRegistry from './registry';

GlobalWorkerOptions.workerSrc = workerSrc;

type Mode = 'single' | 'fixtures' | 'templates';
type Font = 'standard' | 'inter';

type State = {
  mode: Mode;
  template: string;
  fixture: string;
  font: Font;
  color: string;
  fontSize: Size;
  leading: Size;
  zoomSingle: number;
  zoomGrid: number;
};

type Job = { label: string; template: Template; data: ResumeData; file: string };
type Result = {
  job: Job;
  bytes?: Uint8Array;
  error?: unknown;
  ms: number;
  task?: PDFDocumentLoadingTask;
};

const SWATCHES: Record<string, string> = {
  Talvio: '#005BA2',
  Ember: '#670000',
  Mint: '#015408',
  Modern: '#7A7A7A',
};

const DEFAULT_STATE: State = {
  mode: 'single',
  template: 'talvio',
  fixture: 'entry',
  font: 'standard',
  color: SWATCHES.Talvio,
  fontSize: 'md',
  leading: 'md',
  zoomSingle: 1,
  zoomGrid: 0.45,
};

let registry = initialRegistry;
let service: Promise<InstanceType<typeof registry.ResumePDFService>> | null = null;
let results: Result[] = [];
/** The render inputs `results` were generated from, so a download never hands out a stale PDF. */
let resultsKey = '';
let renderId = 0;
let drawId = 0;
/** Set when a change needs new PDFs, so a zoom-only redraw scheduled after it can't drop the render. */
let renderPending = false;
let timer: ReturnType<typeof setTimeout> | undefined;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  mode: $<HTMLSelectElement>('mode'),
  template: $<HTMLSelectElement>('template'),
  fixture: $<HTMLSelectElement>('fixture'),
  templateField: $<HTMLLabelElement>('template-field'),
  fixtureField: $<HTMLLabelElement>('fixture-field'),
  font: $<HTMLSelectElement>('font'),
  color: $<HTMLInputElement>('color'),
  swatches: $<HTMLSpanElement>('swatches'),
  fontSize: $<HTMLSelectElement>('fontSize'),
  leading: $<HTMLSelectElement>('leading'),
  zoom: $<HTMLInputElement>('zoom'),
  zoomValue: $<HTMLOutputElement>('zoom-value'),
  download: $<HTMLButtonElement>('download'),
  status: $<HTMLParagraphElement>('status'),
  preview: $<HTMLElement>('preview'),
  error: $<HTMLPreElement>('error'),
};

// State lives in the URL hash, so a full reload (for example after editing this file) keeps your place.
function loadState(): State {
  try {
    const saved = JSON.parse(decodeURIComponent(location.hash.slice(1)) || '{}');
    return { ...DEFAULT_STATE, ...saved };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

const state = loadState();

function saveState() {
  history.replaceState(null, '', `#${encodeURIComponent(JSON.stringify(state))}`);
}

const zoom = () => (state.mode === 'single' ? state.zoomSingle : state.zoomGrid);

function fillSelect(select: HTMLSelectElement, keys: string[], selected: string) {
  select.replaceChildren(...keys.map((key) => new Option(key, key, false, key === selected)));
}

function syncControls() {
  const templateKeys = Object.keys(registry.templates);
  const fixtureKeys = Object.keys(registry.fixtures);
  if (!templateKeys.includes(state.template)) state.template = templateKeys[0];
  if (!fixtureKeys.includes(state.fixture)) state.fixture = fixtureKeys[0];

  fillSelect(el.template, templateKeys, state.template);
  fillSelect(el.fixture, fixtureKeys, state.fixture);
  el.mode.value = state.mode;
  el.font.value = state.font;
  el.color.value = state.color;
  el.fontSize.value = state.fontSize;
  el.leading.value = state.leading;
  el.zoom.value = String(zoom());
  el.zoomValue.textContent = `${Math.round(zoom() * 100)}%`;
  el.templateField.hidden = state.mode === 'templates';
  el.fixtureField.hidden = state.mode === 'fixtures';
  el.download.disabled = state.mode !== 'single';
  el.download.title = state.mode === 'single' ? '' : 'Switch to "One resume" to download';
}

function jobs(): Job[] {
  const { templates, fixtures } = registry;
  if (state.mode === 'fixtures') {
    return Object.entries(fixtures).map(([key, data]) => ({
      label: key,
      template: templates[state.template],
      data,
      file: `${state.template}-${key}`,
    }));
  }
  if (state.mode === 'templates') {
    return Object.entries(templates).map(([key, template]) => ({
      label: key,
      template,
      data: fixtures[state.fixture],
      file: `${key}-${state.fixture}`,
    }));
  }
  return [
    {
      label: `${state.template} · ${state.fixture}`,
      template: templates[state.template],
      data: fixtures[state.fixture],
      file: `${state.template}-${state.fixture}`,
    },
  ];
}

const renderKey = () =>
  JSON.stringify([
    state.mode,
    state.template,
    state.fixture,
    state.font,
    state.color,
    state.fontSize,
    state.leading,
  ]);

/** Shares one in-flight `create()` between overlapping renders, so fonts are only fetched once. */
function getService() {
  if (!service) {
    const pending = (async () => {
      const next = new registry.ResumePDFService();
      await next.create({
        color: state.color,
        fontSize: state.fontSize,
        leading: state.leading,
        isPreview: false,
      });
      return next;
    })();
    pending.catch(() => {
      if (service === pending) service = null;
    });
    service = pending;
  }
  return service;
}

/** Generates the PDFs, then draws them. Only the latest call gets to replace the results. */
async function render() {
  renderPending = false;
  const id = ++renderId;
  const key = renderKey();
  const list = jobs();
  el.status.textContent = 'Rendering…';
  try {
    const pdf = await getService();
    if (id !== renderId) return;
    const next: Result[] = [];
    for (const job of list) {
      const started = performance.now();
      try {
        const bytes = await pdf.generate({
          data: job.data,
          template: job.template,
          options: {
            color: state.color,
            fontSize: state.fontSize,
            leading: state.leading,
            customFont: state.font === 'inter' ? registry.interFont : undefined,
          },
        });
        next.push({ job, bytes, ms: performance.now() - started });
      } catch (error) {
        next.push({ job, error, ms: performance.now() - started });
      }
      if (id !== renderId) return;
    }
    const previous = results;
    results = next;
    resultsKey = key;
    await draw();
    release(previous);
  } catch (error) {
    if (id === renderId) showError(error);
  }
}

/** Parses a result's PDF once and keeps it, so zoom changes only re-rasterise. */
function openDoc(result: Result, bytes: Uint8Array) {
  // pdf.js takes ownership of the buffer it is given, so hand it a copy and keep the original for downloads.
  result.task ??= getDocument({ data: bytes.slice() });
  return result.task.promise;
}

function release(old: Result[]) {
  for (const { task } of old) void task?.destroy();
}

/** Rasterises the latest results at the current zoom. Only the latest call gets to touch the page. */
async function draw() {
  const id = ++drawId;
  try {
    await drawResults(id);
  } catch (error) {
    if (id === drawId) showError(error);
  }
}

async function drawResults(id: number) {
  const current = results;
  const dpr = window.devicePixelRatio || 1;
  const scale = zoom();
  const fragment = document.createDocumentFragment();
  let pageTotal = 0;
  let firstError: unknown;

  for (const result of current) {
    const { job, bytes, error, ms } = result;
    const row = document.createElement('section');
    row.className = 'row';
    const heading = document.createElement('h2');
    row.append(heading);

    if (error || !bytes) {
      firstError ??= error;
      heading.textContent = job.label;
      const message = document.createElement('pre');
      message.className = 'row-error';
      message.textContent = formatError(error);
      row.append(message);
      fragment.append(row);
      continue;
    }

    const doc = await openDoc(result, bytes);
    pageTotal += doc.numPages;
    heading.innerHTML = `${job.label} <small>${doc.numPages} page${doc.numPages === 1 ? '' : 's'} · ${Math.round(ms)} ms · ${(bytes.length / 1024).toFixed(0)} KB</small>`;

    const pages = document.createElement('div');
    pages.className = 'pages';
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      await page.render({ canvas, viewport }).promise;
      pages.append(canvas);
    }
    row.append(pages);
    fragment.append(row);
    if (id !== drawId) return;
  }
  if (id !== drawId) return;

  // Swap the whole preview at once so the scroll position holds and nothing flickers.
  el.preview.classList.toggle('grid', state.mode !== 'single');
  el.preview.replaceChildren(fragment);
  const failed = current.filter((r) => r.error).length;
  el.status.textContent =
    `${current.length} render${current.length === 1 ? '' : 's'}, ${pageTotal} page${pageTotal === 1 ? '' : 's'}` +
    (failed ? `, ${failed} failed` : '') +
    ` · ${new Date().toLocaleTimeString()}`;
  if (firstError) showError(firstError);
  else hideError();
}

function formatError(error: unknown) {
  return error instanceof Error ? error.stack || error.message : String(error);
}

function showError(error: unknown) {
  el.error.textContent = formatError(error);
  el.error.hidden = false;
  el.status.textContent = 'Render failed';
}

function hideError() {
  el.error.hidden = true;
}

function schedule(fn: () => void, delay = 60) {
  clearTimeout(timer);
  timer = setTimeout(fn, delay);
}

function update(patch: Partial<State>, redrawOnly = false) {
  Object.assign(state, patch);
  saveState();
  syncControls();
  if (!redrawOnly) renderPending = true;
  schedule(() => void (renderPending ? render() : draw()));
}

el.mode.addEventListener('change', () => update({ mode: el.mode.value as Mode }));
el.template.addEventListener('change', () => update({ template: el.template.value }));
el.fixture.addEventListener('change', () => update({ fixture: el.fixture.value }));
el.font.addEventListener('change', () => update({ font: el.font.value as Font }));
el.color.addEventListener('input', () => update({ color: el.color.value }));
el.fontSize.addEventListener('change', () => update({ fontSize: el.fontSize.value as Size }));
el.leading.addEventListener('change', () => update({ leading: el.leading.value as Size }));
el.zoom.addEventListener('input', () => {
  const value = Number(el.zoom.value);
  update(state.mode === 'single' ? { zoomSingle: value } : { zoomGrid: value }, true);
});

el.swatches.append(
  ...Object.entries(SWATCHES).map(([name, color]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = `${name} ${color}`;
    button.style.background = color;
    button.addEventListener('click', () => update({ color }));
    return button;
  }),
);

el.download.addEventListener('click', () => {
  const result = results[0];
  if (!result?.bytes || resultsKey !== renderKey()) {
    el.status.textContent = 'Still rendering. Try again when the preview updates.';
    return;
  }
  const url = URL.createObjectURL(new Blob([result.bytes.slice()], { type: 'application/pdf' }));
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `${result.job.file}.pdf`,
  });
  link.click();
  // Revoking in the same task can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

if (import.meta.hot) {
  import.meta.hot.accept('./registry', (mod) => {
    if (!mod) return;
    const next = mod as unknown as typeof registry;
    // Template and fixture edits keep the service (and its embedded fonts); engine edits need a new one.
    if (next.ResumePDFService !== registry.ResumePDFService) service = null;
    registry = next;
    syncControls();
    void render();
  });
}

syncControls();
saveState();
void render();
