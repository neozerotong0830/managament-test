import { drawDial } from '../assets/dial.js';
import { closeDialog, toast } from '../assets/fx.js';
import {
  CERT_FORMS,
  COMPANIES,
  DISCIPLINES,
  DOC_KINDS,
  REPAIR_TYPES,
  ROLES,
  STATUSES,
} from './catalog.js';
import { applyHourLink, canMount, engineIsRepairing, meterPunch, trailStamp } from './engines.js';
import { esc, safeSrc, splitShift, today, uid } from './format.js';
import { destroyMap, focusMachine, mountMap } from './map.js';
import { dueCertificates, fleetDial, renderAlertSheet, renderRoute } from './pages.js?v=38';
import { mountWeather } from './weather.js';
import {
  commit,
  currentUserId,
  descendants,
  engineByCode,
  engineById,
  getState,
  init,
  machineByCode,
  machineById,
  machineTypeByCode,
  newId,
  nextEngineCode,
  nextMachineCode,
  nextRepairNumber,
  personById,
  repairByNumber,
  resetData,
  setCurrentUser,
  staffIdsOf,
} from './store.js';

const TITLES = {
  overview: '首頁',
  machines: '機械',
  engines: '引擎',
  drills: '鑽具',
  electrical: '電器',
  tools: '地盤工具',
  repairs: '維修',
  hours: '機鐘',
  fleet: '設備總覽',
  map: '地圖分佈',
  papers: '證書及文件',
  dept: '部門組織圖',
  users: '用戶管理',
  stores: '物資',
};

let draft = null;
let meterDraft = null;
let formCache = null;
let specRows = [];
let specTouched = false;
let specFocus = false;
let pendingTypePreview;
let notice = '';
let listQ = '';
let lastPath = '';
let lastView = '';
let entered = false;
const photoFocus = {};

const state = init();

const main = document.getElementById('app');
const cmd = document.getElementById('cmd');
const side = document.getElementById('side');
const tab = document.getElementById('tab');

window.addEventListener('hashchange', () => render());
document.addEventListener('click', onClick);
document.addEventListener('change', onChange);
document.addEventListener('input', onInput);
document.addEventListener('submit', (event) => event.preventDefault());
document.addEventListener('keydown', (event) => {
  const dialog = document.getElementById('preview');
  if (!dialog?.open) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const dir = event.key === 'ArrowLeft' ? '-1' : '1';
  const button = dialog.querySelector(`[data-act="photo-step"][data-dir="${dir}"]`);
  if (!button || button.disabled) return;
  event.preventDefault();
  button.click();
});

for (const id of ['sheet', 'ask', 'preview']) {
  const dialog = document.getElementById(id);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog(dialog);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
}

if (!location.hash) history.replaceState(null, '', '#/');
render();
pushNotify();

function parseHash() {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : '/';
  const [pathPart, qs] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const parts = path.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: path || '/', parts, query };
}

function render() {
  const route = parseHash();
  const viewKey = `${route.path}|${route.query.person || ''}|${route.query.machine || ''}|${route.query.engine || ''}|${route.query.type || ''}|${route.query.at || ''}`;
  const pathChanged = route.path !== lastPath;
  const viewChanged = viewKey !== lastView;
  if (pathChanged) {
    lastPath = route.path;
    listQ = '';
  }
  if (viewChanged) {
    lastView = viewKey;
    formCache = null;
    notice = '';
    setupDraft(route);
    setupSpecs(route);
    setupMeter(route);
    entered = true;
    for (const id of ['preview', 'sheet']) {
      const dialog = document.getElementById(id);
      if (dialog?.open) closeDialog(dialog);
    }
  }
  destroyMap();
  const user = personById(currentUserId());
  const due = dueCertificates(state).length;
  paintChrome(route, user, due);
  const machineCode = route.parts[0] === 'machines' ? route.parts[1] : '';
  const focused = machineCode ? machineByCode(machineCode) : null;
  main.innerHTML = renderRoute(route, {
    state,
    user,
    draft,
    formCache,
    notice,
    q: listQ,
    routeQuery: route.query,
    photoId: photoFocus[focused?.id] || '',
    specRows,
    typePreview: pendingTypePreview,
    meterDraft,
  });
  document.title = `${TITLES[route.parts[0]] || '首頁'} · 機械部管理系統`;
  if (!route.parts[0]) mountWeather(main);
  if (route.parts[0] === 'fleet') {
    const dial = main.querySelector('[data-dial]');
    if (dial) drawDial(dial, fleetDial(state));
  }
  if (route.parts[0] === 'map') mountMap(route.query.at || '');
  if (specFocus) {
    specFocus = false;
    const labels = main.querySelectorAll('[name="specLabel"], [name="fieldLabel"]');
    labels[labels.length - 1]?.focus();
  }
  applySearch();
  if (entered) {
    entered = false;
    main.querySelector('h1')?.focus({ preventScroll: true });
  }
}

function paintChrome(route, user, due) {
  const section = route.parts[0] || 'overview';
  const item = (id, zh, en, href, count = 0, nest = false) => {
    const current = section === id;
    return `<a class="${nest ? 'sub nest' : 'sub'}" href="${href}" ${current ? 'aria-current="page"' : ''}>${esc(zh)}<small>${esc(en)}</small>${count ? `<span class="n">${count}</span>` : ''}</a>`;
  };
  const block = (no, zh, en) => `<p class="group"><small>${esc(no)} ${esc(en)}</small><strong>${esc(zh)}</strong></p>`;
  const homeCurrent = section === 'overview' ? ' aria-current="page"' : '';
  const repairing = state.machines.filter((machine) => machine.status === '維修中').length;
  const engineAlerts = (state.engines || []).filter((engine) => engineIsRepairing(engine, state.repairs)).length;
  const openRepairs = state.repairs.filter((item) => item.status === 'open').length;
  side.innerHTML = `<a class="brand" href="#/"><span class="seal" aria-hidden="true">機</span><span><small>MECH</small>機械部</span></a>
    <a class="head-link" href="#/"${homeCurrent}><small>01 Home</small>主頁</a>
    ${block('02', '設備管理', 'Equipment')}
    ${item('fleet', '總覽', 'Overview', '#/fleet', repairing)}
    ${item('machines', '機械', 'Machines', '#/machines')}
    ${item('engines', '引擎', 'Engines', '#/engines', engineAlerts, true)}
    ${item('drills', '鑽具', 'Drilling tool', '#/drills')}
    ${item('electrical', '電器', 'Electrical equipment', '#/electrical')}
    ${item('tools', '地盤工具', 'Site tool', '#/tools')}
    ${item('map', '地圖分佈', 'Map', '#/map')}
    ${item('repairs', '維修紀錄', 'Repairs', '#/repairs', openRepairs)}
    ${block('03', '後勤管理', 'Logistics')}
    ${item('papers', '證書及文件', 'Certificates & document', '#/papers', due)}
    ${item('stores', '物資', 'Stores', '#/stores')}
    ${block('04', '部門管理', 'Department')}
    ${item('dept', '部門組織圖', 'Organization', '#/dept')}
    ${item('users', '用戶管理', 'Users', '#/users')}`;
  const people = state.people.map((person) => `<option value="${esc(person.id)}"${person.id === user?.id ? ' selected' : ''}>${esc(person.name)}</option>`).join('');
  const dark = document.documentElement.dataset.theme === 'dark';
  cmd.innerHTML = `<label class="who"><select id="who" aria-label="當前人員">${people}</select></label>
    <button class="ef-btn small" type="button" data-act="open-alerts">提醒${due ? ` <span class="alert-count">${due}</span>` : ''}</button>
    <button class="ef-btn small" type="button" data-act="theme" aria-pressed="${dark ? 'true' : 'false'}">深淺</button>`;
  const moreCurrent = ['fleet', 'engines', 'drills', 'electrical', 'tools', 'papers', 'stores', 'dept', 'users'].includes(section);
  const tabs = [
    ['overview', 'Home', '首頁', '#/'],
    ['machines', 'Machines', '機械', '#/machines'],
    ['repairs', 'Repairs', '維修', '#/repairs'],
    ['map', 'Map', '地圖', '#/map'],
  ];
  tab.innerHTML = `${tabs.map(([id, en, zh, href]) => `<a href="${href}" ${section === id ? 'aria-current="page"' : ''}><small>${esc(en)}</small>${esc(zh)}</a>`).join('')}
    <button type="button" data-act="open-more" ${moreCurrent ? 'aria-current="page"' : ''}><small>More</small>更多</button>`;
}

function setupMeter(route) {
  meterDraft = null;
  if (route.parts[0] !== 'hours') return;
  const machines = state.machines
    .filter((item) => Number.isFinite(Number(item.hours)))
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code));
  meterDraft = {
    date: today(),
    rows: machines[0] ? [{ machineId: machines[0].id, reading: '' }] : [],
  };
}

function pullMeter() {
  const form = document.getElementById('meter-form');
  if (!form || !meterDraft) return;
  if (form.elements.date) meterDraft.date = form.elements.date.value;
  meterDraft.rows = [...form.querySelectorAll('[data-meter-row]')].map((row) => ({
    machineId: row.querySelector('[data-meter-machine]')?.value || '',
    reading: row.querySelector('[data-meter-reading]')?.value ?? '',
  }));
}

function paintMeterReading(input) {
  const row = input.closest('[data-meter-row]');
  if (!row) return;
  const punch = input.value === '' ? null : meterPunch(row.dataset.previous, row.dataset.cumulative, input.value);
  const run = row.querySelector('[data-meter-run]');
  const sum = row.querySelector('[data-meter-sum]');
  const shown = (value) => Number(value).toLocaleString('en-HK');
  if (run) run.textContent = punch ? `${shown(punch.run)} 小時` : '—';
  if (sum) sum.textContent = punch ? shown(punch.cumulative) : '—';
  const slot = row.querySelector('.meter-now');
  let flag = slot?.querySelector('.ef-state');
  let note = slot?.querySelector('small');
  if (punch?.replaced) {
    if (!flag) {
      flag = document.createElement('span');
      flag.className = 'ef-state is-alert';
      flag.textContent = '換新錶';
      slot.append(flag);
    }
    if (!note) {
      note = document.createElement('small');
      note.textContent = '讀數低於上次，已視為換新錶。';
      slot.append(note);
    }
  } else {
    flag?.remove();
    note?.remove();
  }
  const filled = [...document.querySelectorAll('[data-meter-reading]')].filter((item) => item.value !== '').length;
  const total = document.querySelectorAll('[data-meter-row]').length;
  const count = document.querySelector('.meter-foot .ef-field');
  if (count) count.textContent = `已填寫 ${filled} / ${total} 部機械`;
}

function addMeterRow() {
  pullMeter();
  const used = new Set(meterDraft.rows.map((row) => row.machineId));
  const next = state.machines
    .filter((item) => Number.isFinite(Number(item.hours)) && !used.has(item.id))
    .sort((a, b) => a.code.localeCompare(b.code))[0];
  if (!next) {
    toast('沒有其他有機鐘的設備。');
    return;
  }
  meterDraft.rows.push({ machineId: next.id, reading: '' });
  render();
}

function removeMeterRow(index) {
  pullMeter();
  meterDraft.rows.splice(index, 1);
  if (!meterDraft.rows.length) {
    const first = state.machines.find((item) => Number.isFinite(Number(item.hours)));
    if (first) meterDraft.rows.push({ machineId: first.id, reading: '' });
  }
  render();
}

function saveMeter(button) {
  pullMeter();
  if (!meterDraft.date) {
    notice = flag('注意', '請填日期。');
    render();
    return;
  }
  const seen = new Set();
  const punches = [];
  for (const row of meterDraft.rows) {
    const machine = machineById(row.machineId);
    if (!machine || !Number.isFinite(Number(machine.hours))) {
      notice = flag('注意', '請選擇有運行機鐘的設備。');
      render();
      return;
    }
    if (seen.has(machine.id)) {
      notice = flag('注意', `${machine.code} 不能記兩次。`);
      render();
      return;
    }
    seen.add(machine.id);
    if (String(row.reading) === '') {
      notice = flag('注意', `請填 ${machine.code} 的本次讀數。`);
      render();
      return;
    }
    const face = machine.meter == null || machine.meter === '' ? Number(machine.hours) || 0 : Number(machine.meter) || 0;
    const punch = meterPunch(face, machine.hours, row.reading);
    if (!punch || punch.run <= 0) {
      notice = flag('注意', `${machine.code} 的讀數沒有增加運行時數。`);
      render();
      return;
    }
    punches.push({ machine, punch });
  }
  if (!punches.length) {
    notice = flag('注意', '請至少記一部設備。');
    render();
    return;
  }
  button.setAttribute('aria-busy', 'true');
  if (!Array.isArray(state.hourLogs)) state.hourLogs = [];
  for (const { machine, punch } of punches) {
    const face = machine.meter == null || machine.meter === '' ? Number(machine.hours) || 0 : Number(machine.meter) || 0;
    machine.hours = punch.cumulative;
    machine.meter = punch.reading;
    const engine = state.engines.find((item) => item.mountedMachineId === machine.id);
    if (engine) {
      engine.hours = (Number(engine.hours) || 0) + punch.run;
      state.engineTrail.push(trailRow('hours', engine, machine, punch.run));
    }
    state.hourLogs.push({
      id: newId('h-'),
      date: meterDraft.date,
      machineId: machine.id,
      machineCode: machine.code,
      previous: face,
      reading: punch.reading,
      replaced: punch.replaced,
      runHours: punch.run,
      cumulative: punch.cumulative,
      engineId: engine?.id || '',
    });
  }
  commit();
  toast('機鐘已記下');
  location.hash = '#/repairs';
}

function setupDraft(route) {
  draft = null;
  const [section, id, action] = route.parts;
  if (section !== 'repairs') return;
  if (id === 'new') {
    draft = blankDraft();
    const engine = engineByCode(route.query.engine || '');
    if (engine) {
      draft.assetKind = 'engine';
      draft.engineId = engine.id;
      draft.machineId = '';
      draft.location = machineById(engine.mountedMachineId)?.site || '工場';
      draft.equipType = 'engine';
      draft.step = 3;
      return;
    }
    const machine = machineByCode(route.query.machine || '');
    if (machine) {
      draft.machineId = machine.id;
      draft.location = machine.site;
      draft.equipType = 'machine';
      draft.step = 3;
    }
    return;
  }
  if (action === 'session') {
    const repair = repairByNumber(id);
    if (!repair || repair.status !== 'open') return;
    if (repair.assetKind === 'engine') {
      const engine = engineById(repair.engineId);
      if (!engine) return;
      draft = blankDraft();
      draft.repairId = repair.id;
      draft.assetKind = 'engine';
      draft.engineId = engine.id;
      draft.machineId = '';
      draft.location = machineById(engine.mountedMachineId)?.site || '工場';
      draft.equipType = 'engine';
      draft.step = 3;
      return;
    }
    const machine = machineById(repair.machineId);
    if (!machine) return;
    draft = blankDraft();
    draft.repairId = repair.id;
    draft.machineId = machine.id;
    draft.location = machine.site;
    draft.equipType = 'machine';
    draft.step = 3;
  }
  if (action === 'edit') {
    const repair = repairByNumber(id);
    const session = repair?.sessions.find((item) => item.id === route.parts[3]);
    if (!repair || repair.status !== 'open' || !session) return;
    const ids = staffIdsOf(session);
    draft = blankDraft();
    draft.sessionId = session.id;
    draft.repairId = repair.id;
    draft.assetKind = repair.assetKind === 'engine' ? 'engine' : 'machine';
    draft.engineId = repair.engineId || '';
    draft.machineId = repair.machineId || '';
    draft.date = session.date;
    draft.location = session.location || '';
    draft.staffIds = ids.slice();
    draft.staffId = ids[0] || '';
    draft.start = session.start;
    draft.end = session.end;
    draft.type = session.type;
    draft.fault = session.fault || '';
    draft.process = session.process || '';
    draft.parts = (session.parts || []).map((part) => ({
      name: part.name || '',
      qty: part.qty || '1',
      partNo: part.partNo || '',
    }));
  }
  if (!action && id && id !== 'new') {
    const repair = repairByNumber(id);
    if (!repair || repair.status !== 'draft' || repair.ownerId !== currentUserId()) return;
    const session = repair.sessions[0];
    const ids = session ? staffIdsOf(session) : [currentUserId()];
    draft = blankDraft();
    draft.repairId = repair.id;
    draft.assetKind = repair.assetKind === 'engine' ? 'engine' : 'machine';
    draft.equipType = draft.assetKind;
    draft.engineId = repair.engineId || '';
    draft.machineId = repair.machineId || '';
    draft.step = Math.min(Math.max(repair.draftStep || 1, 1), 3);
    if (!session) return;
    draft.date = session.date || draft.date;
    draft.location = session.location || '';
    draft.staffIds = ids.slice();
    draft.staffId = ids[0] || '';
    draft.start = session.start || draft.start;
    draft.end = session.end || draft.end;
    draft.type = session.type || draft.type;
    draft.fault = session.fault || '';
    draft.process = session.process || '';
    draft.parts = (session.parts || []).map((part) => ({
      name: part.name || '',
      qty: part.qty || '1',
      partNo: part.partNo || '',
    }));
  }
}

function setupSpecs(route) {
  specRows = [];
  specTouched = false;
  pendingTypePreview = undefined;
  const [section, id, action] = route.parts;
  if (section === 'machines' && id === 'types') {
    const type = action && action !== 'new' ? machineTypeByCode(action) : null;
    specRows = (type?.fields || []).map((row) => ({
      key: row.key || '',
      label: row.label || '',
      unit: row.unit || '',
      value: '',
    }));
    specTouched = Boolean(type);
    return;
  }
  if (section === 'engines' && (id === 'new' || action === 'edit')) {
    const engine = id === 'new' ? null : engineByCode(id);
    specRows = (engine?.specList || []).map((row) => ({
      label: row.label || '',
      unit: row.unit || '',
      value: row.value || '',
    }));
    specTouched = Boolean(engine);
    return;
  }
  const editing = section === 'machines' && (id === 'new' || action === 'edit');
  if (!editing) return;
  const machine = id === 'new' ? null : machineByCode(id);
  if (machine && Array.isArray(machine.specList)) {
    specRows = machine.specList.map((row) => ({
      label: row.label || '',
      unit: row.unit || '',
      value: row.value || '',
    }));
    specTouched = true;
    return;
  }
  specRows = templateRows(machine?.type || route.query.type || state.machineTypes[0]?.code || 'CC', machine);
}

function templateRows(typeCode, machine) {
  const type = machineTypeByCode(typeCode);
  if (!type) return [];
  return type.fields.map((field) => ({
    label: field.label,
    unit: field.unit,
    value: machine && machine.type === typeCode && field.key ? String(machine.specs?.[field.key] ?? '') : '',
  }));
}

function specFormId() {
  if (document.getElementById('machine-form')) return 'machine-form';
  if (document.getElementById('engine-form')) return 'engine-form';
  if (document.getElementById('type-form')) return 'type-form';
  return '';
}

function pullSpecs() {
  const id = specFormId();
  const form = id ? document.getElementById(id) : null;
  if (!form) return;
  const data = new FormData(form);
  if (id === 'type-form') {
    const labels = data.getAll('fieldLabel');
    const units = data.getAll('fieldUnit');
    const keys = data.getAll('fieldKey');
    specRows = labels.map((label, index) => ({
      key: String(keys[index] ?? ''),
      label: String(label),
      unit: String(units[index] ?? ''),
      value: '',
    }));
    return;
  }
  const labels = data.getAll('specLabel');
  const values = data.getAll('specValue');
  const units = data.getAll('specUnit');
  specRows = labels.map((label, index) => ({
    label: String(label),
    value: String(values[index] ?? ''),
    unit: String(units[index] ?? ''),
  }));
}

function blankDraft() {
  return {
    step: 1,
    repairId: '',
    equipType: '',
    assetKind: 'machine',
    engineId: '',
    machineId: state.machines[0]?.id || '',
    date: today(),
    location: '',
    staffId: currentUserId(),
    staffIds: [currentUserId()],
    start: '08:00',
    end: '18:00',
    type: '保養',
    fault: '',
    process: '',
    parts: [],
  };
}

function capture() {
  if (document.getElementById('repair-form')) pullRepair();
  else if (document.getElementById('meter-form')) pullMeter();
  else if (specFormId()) {
    pullSpecs();
    formCache = rememberForm(specFormId());
  }
  else if (document.getElementById('cert-form')) formCache = readForm('cert-form');
  else if (document.getElementById('doc-form')) formCache = readForm('doc-form');
  else if (document.getElementById('person-form')) formCache = readForm('person-form');
}

function onClick(event) {
  const dialogLink = event.target.closest('dialog a[href^="#"]');
  if (dialogLink) {
    const dialog = dialogLink.closest('dialog');
    if (dialog?.open) closeDialog(dialog);
  }
  const closer = event.target.closest('[data-close]');
  if (closer) {
    const dialog = closer.closest('dialog');
    if (dialog) closeDialog(dialog, closer.dataset.close || '');
    return;
  }
  const go = event.target.closest('[data-go]');
  if (go) {
    const dialog = go.closest('dialog');
    if (dialog?.open) closeDialog(dialog);
    location.hash = go.dataset.go;
    return;
  }
  const actor = event.target.closest('[data-act]');
  if (!actor) return;
  const act = actor.dataset.act;
  if (act === 'theme') flipTheme(event);
  else if (act === 'open-alerts') openSheet(renderAlertSheet(state));
  else if (act === 'open-more') openMore();
  else if (act === 'enable-notify') enableNotify();
  else if (act === 'filter') setQuery({ [actor.dataset.key]: actor.dataset.value || '' });
  else if (act === 'repair-scope') setRepairScope(actor.dataset.value || '');
  else if (act === 'continue-repair') continueRepair(actor.dataset.id);
  else if (act === 'repair-kind') pickRepairKind(actor.dataset.kind);
  else if (act === 'new-repair') {
    pullRepair();
    draft.repairId = '';
    draft.assetKind = 'machine';
    draft.engineId = '';
    if (!draft.machineId) draft.machineId = state.machines[0]?.id || '';
    notice = '';
    render();
  } else if (act === 'step') {
    pullRepair();
    draft.step = Number(actor.dataset.step);
    notice = '';
    render();
  } else if (act === 'repair-next') repairNext();
  else if (act === 'repair-submit') submitRepair(actor.dataset.finish === '1', actor);
  else if (act === 'save-draft') saveDraft();
  else if (act === 'save-session') saveSession();
  else if (act === 'add-spec') {
    pullSpecs();
    specTouched = true;
    specRows.push({ key: '', label: '', unit: '', value: '' });
    const formId = specFormId();
    if (formId) formCache = rememberForm(formId);
    specFocus = true;
    notice = '';
    render();
  } else if (act === 'remove-spec') {
    pullSpecs();
    specTouched = true;
    specRows.splice(Number(actor.dataset.index), 1);
    const formId = specFormId();
    if (formId) formCache = rememberForm(formId);
    notice = '';
    render();
  } else if (act === 'add-part') {
    pullRepair();
    draft.parts.push({ name: '', qty: '1', partNo: '' });
    render();
  } else if (act === 'remove-part') {
    pullRepair();
    draft.parts.splice(Number(actor.dataset.index), 1);
    render();
  } else if (act === 'complete-repair') completeRepair(actor.dataset.id);
  else if (act === 'delete-repair') removeRepair(actor.dataset.id);
  else if (act === 'save-machine') saveMachine(actor);
  else if (act === 'delete-machine') removeMachine(actor.dataset.id);
  else if (act === 'save-type') saveType(actor);
  else if (act === 'clear-type-preview') clearTypePreview();
  else if (act === 'delete-type') removeType(actor.dataset.code);
  else if (act === 'save-engine') saveEngine(actor);
  else if (act === 'delete-engine') removeEngine(actor.dataset.id);
  else if (act === 'mount-engine') mountEngine(actor);
  else if (act === 'unmount-engine') unmountEngine(actor.dataset.id);
  else if (act === 'save-person') savePerson(actor.dataset.id);
  else if (act === 'delete-person') removePerson(actor.dataset.id);
  else if (act === 'select-person') {
    location.hash = `#/users?person=${encodeURIComponent(actor.dataset.id)}`;
  } else if (act === 'save-cert') saveCert(actor);
  else if (act === 'delete-cert') removeCert(actor.dataset.id);
  else if (act === 'save-doc') saveDoc(actor);
  else if (act === 'delete-doc') removeDoc(actor.dataset.id);
  else if (act === 'preview-doc') previewDoc(actor.dataset.source, actor.dataset.id);
  else if (act === 'preview-photo') previewPhoto(actor.dataset.id, actor.dataset.photo);
  else if (act === 'preview-library') previewLibrary(actor.dataset.id, actor.dataset.photo);
  else if (act === 'photo-step') stepPhoto(actor.dataset.id, actor.dataset.dir, actor.dataset.view === '1', actor.dataset.source || '');
  else if (act === 'delete-photo') removePhoto(actor.dataset.id, actor.dataset.photo);
  else if (act === 'make-cover') makeCover(actor.dataset.id, actor.dataset.photo);
  else if (act === 'delete-library') removeLibraryPhoto(actor.dataset.id, actor.dataset.photo);
  else if (act === 'map-focus') focusMachine(actor.dataset.code);
  else if (act === 'save-meter') saveMeter(actor);
  else if (act === 'add-meter') addMeterRow();
  else if (act === 'remove-meter') removeMeterRow(Number(actor.dataset.index));
  else if (act === 'reset-data') resetAll();
  else if (act === 'pick-staff') openStaffPicker();
  else if (act === 'apply-staff') applyStaff();
}

function onChange(event) {
  const target = event.target;
  if (target.id === 'who') {
    capture();
    setCurrentUser(target.value);
    if (draft && !document.getElementById('repair-form')?.querySelector('[name="staffId"]')) {
      draft.staffId = target.value;
      draft.staffIds = target.value ? [target.value] : [];
    }
    render();
    return;
  }
  if (target.matches('[data-repair-filter]')) {
    setQuery({ [target.dataset.repairFilter]: target.value });
    return;
  }
  if (target.matches('[data-meter-machine]')) {
    pullMeter();
    render();
    return;
  }
  if (target.matches('[data-type-select]')) {
    pullSpecs();
    const data = readForm('machine-form');
    const editingId = document.querySelector('[data-act="save-machine"]')?.dataset.id || '';
    const prefix = String(data.code || '').replace(/\d+$/, '');
    if (!editingId && (!data.code || data.code === nextMachineCode(prefix || data.type))) {
      data.code = nextMachineCode(data.type);
    }
    if (!specTouched) specRows = templateRows(data.type, machineById(editingId));
    formCache = data;
    notice = '';
    render();
    return;
  }
  if (target.matches('[data-cert-form]')) {
    const data = readForm('cert-form');
    const meta = CERT_FORMS.find((item) => item.code === data.form);
    if (meta) data.leadDays = String(meta.lead);
    formCache = data;
    render();
    return;
  }
  if (target.matches('[data-photo-for]')) addPhoto(target);
  if (target.matches('[data-library-for]')) addLibraryPhoto(target);
  if (target.matches('[data-type-preview]')) setTypePreview(target);
}

function onInput(event) {
  const target = event.target;
  if (target.matches('[data-search]')) {
    listQ = target.value;
    applySearch();
    return;
  }
  if (target.name === 'specLabel' || target.name === 'specUnit' || target.name === 'fieldLabel' || target.name === 'fieldUnit') specTouched = true;
  if (target.matches('[data-meter-reading]')) {
    paintMeterReading(target);
    return;
  }
  if (target.name === 'start' || target.name === 'end') {
    if (draft) {
      draft.start = target.form.elements.start.value;
      draft.end = target.form.elements.end.value;
    }
    const slot = document.getElementById('shift-readout');
    if (slot) slot.innerHTML = shiftHtml(splitShift(target.form.elements.start.value, target.form.elements.end.value));
  }
}

function shiftHtml(shift) {
  if (!shift) return '<p class="ef-notice" data-flag="注意">請填寫開始和結束時間。</p>';
  const note = shift.overnight ? '<p class="ef-notice" data-flag="跨日">結束時間不晚於開始，這次會當成跨日計算。</p>' : '';
  return `${note}<span class="ef-kv"><span>正班</span><span>${esc(minutes(shift.regularMin))}</span></span>
    <span class="ef-kv"><span>加班</span><span>${esc(minutes(shift.otMin))}</span></span>
    <span class="ef-kv"><span>合計</span><span>${esc(minutes(shift.totalMin))}</span></span>`;
}

function minutes(min) {
  const n = Math.max(0, Math.round(min));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h} 小時 ${m} 分鐘`;
  if (h) return `${h} 小時`;
  return `${m} 分鐘`;
}

function applySearch() {
  const slot = document.getElementById('list-slot');
  if (!slot) return;
  const q = listQ.trim().toLowerCase();
  slot.querySelectorAll('.ef-records > li').forEach((row) => {
    row.hidden = q ? !row.textContent.toLowerCase().includes(q) : false;
  });
  slot.querySelectorAll('.group').forEach((group) => {
    const items = [...group.querySelectorAll('.ef-records > li')];
    group.hidden = items.every((row) => row.hidden);
  });
  const empty = document.getElementById('list-empty');
  if (!empty) return;
  empty.hidden = slot.querySelectorAll('.ef-records > li:not([hidden])').length > 0;
}

function setQuery(patch) {
  const route = parseHash();
  const query = { ...route.query, ...patch };
  for (const [key, value] of Object.entries(query)) if (!value) delete query[key];
  const qs = new URLSearchParams(query).toString();
  location.hash = `${route.path}${qs ? `?${qs}` : ''}`;
}

function setRepairScope(value) {
  setQuery({ mine: value === 'mine' ? '1' : '' });
}

function openStaffPicker() {
  if (!draft) return;
  pullRepair();
  const picked = new Set(draft.staffIds || []);
  const rows = state.people.map((person) => `<tr>
      <td><input type="checkbox" name="pickStaff" value="${esc(person.id)}"${picked.has(person.id) ? ' checked' : ''} aria-label="${esc(person.name)}"></td>
      <td>${esc(person.name)}</td>
      <td>${esc(person.title)}</td>
    </tr>`).join('');
  const dialog = document.getElementById('ask');
  dialog.innerHTML = `<div class="ef-panel">
    <h2>負責人員</h2>
    <p class="ef-lede">可選多於一位。</p>
    <div class="staff-scroll"><table class="staff-table">
      <thead><tr><th></th><th>姓名</th><th>職位</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="ef-actions">
      <button class="ef-btn go" type="button" data-act="apply-staff">確定</button>
      <button class="ef-btn" type="button" data-close>取消</button>
    </p>
  </div>`;
  if (!dialog.open) dialog.showModal();
}

function applyStaff() {
  const ids = [...document.querySelectorAll('#ask [name="pickStaff"]:checked')].map((box) => box.value);
  draft.staffIds = ids;
  draft.staffId = ids[0] || '';
  closeDialog(document.getElementById('ask'));
  render();
}

function pullRepair() {
  const form = document.getElementById('repair-form');
  if (!form || !draft) return;
  const data = new FormData(form);
  for (const key of ['machineId', 'engineId', 'date', 'location', 'start', 'end', 'type', 'fault', 'process']) {
    if (data.has(key)) draft[key] = String(data.get(key) || '');
  }
  if (form.querySelector('[name="staffId"]')) {
    draft.staffIds = data.getAll('staffId').map(String).filter(Boolean);
    draft.staffId = draft.staffIds[0] || '';
  }
  if (form.elements.partName) {
    const names = data.getAll('partName');
    const qtys = data.getAll('partQty');
    const nos = data.getAll('partNo');
    draft.parts = names.map((name, index) => ({
      name: String(name).trim(),
      qty: String(qtys[index] || '1').trim(),
      partNo: String(nos[index] || '').trim(),
    }));
  }
}

function continueRepair(id) {
  pullRepair();
  const repair = state.repairs.find((item) => item.id === id);
  if (!repair || repair.status !== 'open') return;
  draft.repairId = repair.id;
  if (repair.assetKind === 'engine') {
    const engine = engineById(repair.engineId);
    if (!engine) return;
    draft.assetKind = 'engine';
    draft.engineId = engine.id;
    draft.machineId = '';
    draft.location = draft.location || machineById(engine.mountedMachineId)?.site || '工場';
  } else {
    const machine = machineById(repair.machineId);
    if (!machine) return;
    draft.assetKind = 'machine';
    draft.engineId = '';
    draft.machineId = machine.id;
    draft.location = draft.location || machine.site;
  }
  draft.equipType = draft.assetKind;
  draft.step = 3;
  notice = '';
  render();
}

function pickRepairKind(kind) {
  pullRepair();
  draft.equipType = kind || '';
  draft.repairId = '';
  if (kind !== 'machine' && kind !== 'engine') {
    notice = flag('注意', '這類設備的登記稍後開放。');
    render();
    return;
  }
  draft.assetKind = kind;
  if (kind === 'engine') {
    draft.machineId = '';
    draft.engineId = state.engines[0]?.id || '';
    draft.location = machineById(engineById(draft.engineId)?.mountedMachineId)?.site || '工場';
  } else {
    draft.engineId = '';
    draft.machineId = state.machines[0]?.id || '';
    draft.location = machineById(draft.machineId)?.site || '';
  }
  draft.step = 2;
  notice = '';
  render();
}

function repairNext() {
  pullRepair();
  const problem = draft.step === 2 ? validateRepairStep(1) : validateRepairStep(draft.step);
  if (problem) {
    notice = flag('注意', problem);
    render();
    return;
  }
  if (draft.step === 2 && !draft.repairId && draft.assetKind !== 'engine') {
    const machine = machineById(draft.machineId);
    if (machine && !draft.location) draft.location = machine.site;
  }
  if (draft.step === 2 && !draft.repairId && draft.assetKind === 'engine') {
    const host = machineById(engineById(draft.engineId)?.mountedMachineId);
    if (host && !draft.location) draft.location = host.site;
  }
  draft.step += 1;
  notice = '';
  render();
}

function validateRepairStep(step) {
  if (step === 1) {
    if (draft.repairId) return '';
    if (draft.assetKind === 'engine') {
      if (!draft.engineId) return '請選擇引擎，或接續一項未完成的維修。';
      return '';
    }
    if (!draft.machineId) return '請選擇機械，或接續一項未完成的維修。';
    return '';
  }
  if (step === 2) {
    if (!draft.date || !draft.location.trim() || !draft.staffIds?.length) return '請填日期、地點和負責人員。';
    return '';
  }
  if (step === 3) {
    const shift = splitShift(draft.start, draft.end);
    if (!shift || shift.totalMin <= 0) return '請填寫開始和結束時間。';
    return '';
  }
  if (!REPAIR_TYPES.includes(draft.type)) return '請選擇維修類型。';
  if (draft.type === '突發維修' && !draft.fault.trim()) return '突發維修要填故障原因。';
  if (!draft.process.trim()) return '請填寫維修過程。';
  return '';
}

function submitRepair(finish, button) {
  pullRepair();
  const problem = [2, 3, 4].map((step) => validateRepairStep(step)).find(Boolean);
  if (problem) {
    notice = flag('注意', problem);
    render();
    return;
  }
  button.setAttribute('aria-busy', 'true');
  const session = {
    id: uid('s-'),
    date: draft.date,
    location: draft.location.trim(),
    staffId: draft.staffIds[0] || '',
    staffIds: draft.staffIds.slice(),
    start: draft.start,
    end: draft.end,
    type: draft.type,
    fault: draft.fault.trim(),
    process: draft.process.trim(),
    parts: draft.parts.filter((part) => part.name),
  };
  let repair = state.repairs.find((item) => item.id === draft.repairId);
  if (repair?.status === 'draft') {
    if (repair.ownerId !== currentUserId()) {
      toast('這份草稿不是你的');
      return;
    }
    session.id = repair.sessions[0]?.id || session.id;
    repair.sessions = [session];
    repair.assetKind = draft.assetKind === 'engine' ? 'engine' : 'machine';
    repair.engineId = repair.assetKind === 'engine' ? draft.engineId : '';
    repair.machineId = repair.assetKind === 'engine' ? '' : draft.machineId;
    delete repair.draftStep;
  } else if (repair) {
    repair.sessions.push(session);
  } else {
    const engineJob = draft.assetKind === 'engine';
    repair = {
      id: newId('r-'),
      number: nextRepairNumber(),
      assetKind: engineJob ? 'engine' : 'machine',
      engineId: engineJob ? draft.engineId : '',
      machineId: engineJob ? '' : draft.machineId,
      status: 'open',
      openedOn: draft.date,
      closedOn: '',
      sessions: [session],
    };
    state.repairs.push(repair);
  }
  if (finish) {
    repair.status = 'done';
    repair.closedOn = draft.date;
  } else repair.status = 'open';
  if (repair.assetKind !== 'engine') syncMachine(repair.machineId);
  commit();
  toast(finish ? `${repair.number} 已完成` : `${repair.number} 已保存，可再續做`);
  location.hash = `#/repairs/${repair.number}`;
}

function saveDraft() {
  pullRepair();
  const engineJob = draft?.assetKind === 'engine';
  if (!draft || (engineJob ? !draft.engineId : !draft.machineId)) {
    toast('請先選擇機械或引擎');
    return;
  }
  const session = {
    id: uid('s-'),
    date: draft.date,
    location: draft.location.trim(),
    staffId: draft.staffIds?.[0] || currentUserId(),
    staffIds: (draft.staffIds?.length ? draft.staffIds : [currentUserId()]).slice(),
    start: draft.start,
    end: draft.end,
    type: draft.type,
    fault: draft.fault.trim(),
    process: draft.process.trim(),
    parts: (draft.parts || []).filter((part) => part.name),
  };
  let repair = state.repairs.find((item) => item.id === draft.repairId);
  if (repair && (repair.status !== 'draft' || repair.ownerId !== currentUserId())) {
    toast('這項紀錄不能存成草稿');
    return;
  }
  if (repair) {
    session.id = repair.sessions[0]?.id || session.id;
    repair.sessions = [session];
    repair.assetKind = engineJob ? 'engine' : 'machine';
    repair.engineId = engineJob ? draft.engineId : '';
    repair.machineId = engineJob ? '' : draft.machineId;
    repair.draftStep = draft.step;
  } else {
    repair = {
      id: newId('r-'),
      number: nextRepairNumber(),
      assetKind: engineJob ? 'engine' : 'machine',
      engineId: engineJob ? draft.engineId : '',
      machineId: engineJob ? '' : draft.machineId,
      status: 'draft',
      ownerId: currentUserId(),
      draftStep: draft.step,
      openedOn: draft.date,
      closedOn: '',
      sessions: [session],
    };
    state.repairs.push(repair);
  }
  commit();
  toast(`${repair.number} 已存成草稿`);
  location.hash = '#/repairs?status=draft';
}

function saveSession() {
  pullRepair();
  const repair = state.repairs.find((item) => item.id === draft?.repairId);
  const session = repair?.sessions.find((item) => item.id === draft?.sessionId);
  if (!repair || !session || repair.status !== 'open') {
    toast('這項維修已完成，不能再改');
    return;
  }
  for (const step of [2, 3, 4]) {
    const problem = validateRepairStep(step);
    if (problem) {
      notice = flag('注意', problem);
      render();
      return;
    }
  }
  Object.assign(session, {
    date: draft.date,
    location: draft.location.trim(),
    staffId: draft.staffIds[0] || '',
    staffIds: draft.staffIds.slice(),
    start: draft.start,
    end: draft.end,
    type: draft.type,
    fault: draft.fault.trim(),
    process: draft.process.trim(),
    parts: draft.parts.filter((part) => part.name),
  });
  commit();
  toast('已更新');
  location.hash = `#/repairs/${repair.number}`;
}

function completeRepair(id) {
  const repair = state.repairs.find((item) => item.id === id);
  if (!repair) return;
  repair.status = 'done';
  repair.closedOn = today();
  if (repair.assetKind !== 'engine') syncMachine(repair.machineId);
  commit();
  toast(`${repair.number} 已標為完成`);
  render();
}

function syncMachine(machineId) {
  const machine = machineById(machineId);
  if (!machine) return;
  const open = state.repairs.some((item) => item.machineId === machineId && item.status === 'open');
  if (open && machine.status === '在場') machine.status = '維修中';
  if (!open && machine.status === '維修中') machine.status = '在場';
}

async function removeRepair(id) {
  const repair = state.repairs.find((item) => item.id === id);
  if (!repair) return;
  const ok = await ask('刪除這項維修', `${repair.number} 和裡面每一次紀錄會一併刪除。`, '刪除這項維修');
  if (!ok) return;
  state.repairs = state.repairs.filter((item) => item.id !== id);
  if (repair.assetKind !== 'engine') syncMachine(repair.machineId);
  commit();
  toast('已刪除');
  location.hash = '#/repairs';
}

async function saveMachine(button) {
  pullSpecs();
  const data = readForm('machine-form');
  const type = machineTypeByCode(data.type);
  if (!type) return failMachine(data, '請選擇機械種類。');
  let code = String(data.code || '').trim().toUpperCase();
  if (!code) code = nextMachineCode(type.code);
  if (!code.startsWith(type.code) || !/^[A-Z]+\d+$/.test(code)) {
    return failMachine(data, `編號要用 ${type.code} 加號碼，例如 ${type.code}01。`);
  }
  const id = button.dataset.id;
  if (state.machines.some((item) => item.code === code && item.id !== id)) return failMachine(data, '這個編號已經用過。');
  if (!COMPANIES.includes(data.company)) return failMachine(data, '請選擇所屬公司。');
  if (!DISCIPLINES.some((item) => item.code === data.discipline)) return failMachine(data, '請選擇工程類別。');
  if (!STATUSES.includes(data.status)) return failMachine(data, '請選擇狀態。');
  for (const key of ['manufacturer', 'model', 'serial', 'site']) {
    if (!String(data[key] || '').trim()) return failMachine(data, '廠商、型號、序列號和地盤都要填。');
  }
  const year = Number(data.yearMade);
  if (!Number.isInteger(year) || year < 1970 || year > 2035) return failMachine(data, '請填寫出廠年份。');
  const hours = Number(data.hours);
  if (!Number.isFinite(hours) || hours < 0) return failMachine(data, '請填寫累計運行機鐘。');
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return failMachine(data, '請填寫地盤的緯度和經度。');
  const specList = [];
  for (const row of specRows) {
    const label = row.label.trim();
    const value = row.value.trim();
    const unit = row.unit.trim();
    if (!label && !value && !unit) continue;
    if (!label) return failMachine(data, '請為每一項特定數據填名稱，或刪掉空白項。');
    specList.push({ label, value, unit });
  }
  const prior = state.machines.find((item) => item.id === id);
  const mounted = prior ? state.engines.find((item) => item.mountedMachineId === prior.id) : null;
  if (mounted && !type.mountsEngine) return failMachine(data, '這台機械安裝了引擎，不能改成不能掛引擎的種類。');
  button.setAttribute('aria-busy', 'true');
  let linkedNote = '';
  if (prior && mounted) {
    const applied = applyHourLink(mounted.hours, prior.hours, hours);
    if (applied.delta > 0) {
      mounted.hours = applied.engineHours;
      state.engineTrail.push(trailRow('hours', mounted, { id: prior.id, code, hours }, applied.delta));
      linkedNote = `引擎 ${mounted.code} 機鐘增加 ${applied.delta} 小時`;
    }
  }
  const record = {
    id: prior?.id || newId('m-'),
    code,
    type: type.code,
    company: data.company,
    discipline: data.discipline,
    manufacturer: data.manufacturer.trim(),
    model: data.model.trim(),
    serial: data.serial.trim(),
    yearMade: year,
    hours,
    site: data.site.trim(),
    lat,
    lng,
    status: data.status,
    specs: prior?.specs || {},
    specList,
    photos: prior?.photos || [],
    library: prior?.library || [],
  };
  if (prior) Object.assign(prior, record);
  else state.machines.push(record);
  commit();
  const outside = lat < 22.13 || lat > 22.58 || lng < 113.82 || lng > 114.45;
  const notes = [`${code} 已保存`];
  if (outside) notes.push('位置不在香港常用範圍');
  if (linkedNote) notes.push(linkedNote);
  toast(notes.join('。'));
  location.hash = `#/machines/${code}`;
}

function failMachine(data, text) {
  formCache = data;
  notice = flag('注意', text);
  render();
}

async function removeMachine(id) {
  const machine = machineById(id);
  if (!machine) return;
  if (state.engines.some((item) => item.mountedMachineId === id)) {
    toast('這台機械仍安裝著引擎，先拆卸才能刪除');
    return;
  }
  const used = state.repairs.some((item) => item.assetKind !== 'engine' && item.machineId === id)
    || state.certificates.some((item) => item.machineId === id)
    || state.documents.some((item) => item.machineId === id);
  if (used) {
    toast('這台機械仍有維修、證書或文件，不能刪除');
    return;
  }
  const ok = await ask('刪除這台機械', `${machine.code} 會從名冊移除。`, '刪除這台機械');
  if (!ok) return;
  state.machines = state.machines.filter((item) => item.id !== id);
  commit();
  toast('已刪除');
  location.hash = machine.type ? `#/machines/type/${machine.type}` : '#/machines';
}

function saveType(button) {
  pullSpecs();
  const data = readForm('type-form');
  const priorCode = button.dataset.code || '';
  const prior = machineTypeByCode(priorCode);
  const used = prior ? state.machines.some((item) => item.type === prior.code) : false;
  const code = used ? prior.code : String(data.code || '').trim().toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(code)) return failNote('代號要用 2 至 4 個英文字母，例如 SC。', data);
  if (state.machineTypes.some((item) => item.code === code && item.code !== priorCode)) return failNote('這個代號已經用過。', data);
  const name = String(data.name || '').trim();
  const short = String(data.short || '').trim();
  if (!name || !short) return failNote('請填寫名稱和簡稱。', data);
  if (short.length > 6) return failNote('簡稱最多 6 個字，錶盤才放得下。', data);
  const mountsEngine = data.mountsEngine === '1';
  if (prior?.mountsEngine && !mountsEngine) {
    const hosts = new Set(state.machines.filter((item) => item.type === prior.code).map((item) => item.id));
    if (state.engines.some((item) => hosts.has(item.mountedMachineId))) {
      return failNote('這類機械上仍有引擎，先拆卸才能關閉安裝。', data);
    }
  }
  const fields = [];
  for (const row of specRows) {
    const label = row.label.trim();
    const unit = row.unit.trim();
    if (!label && !unit) continue;
    if (!label) return failNote('請為每一項預設欄位填名稱，或刪掉空白項。', data);
    fields.push({ key: row.key || '', label, unit });
  }
  let preview = prior?.preview?.dataUrl ? prior.preview : null;
  if (pendingTypePreview === null) preview = null;
  else if (pendingTypePreview?.dataUrl) preview = pendingTypePreview;
  const record = { code, name, short, mountsEngine, fields };
  if (preview?.dataUrl) record.preview = { name: preview.name || '', dataUrl: preview.dataUrl };
  pendingTypePreview = undefined;
  if (prior) {
    const index = state.machineTypes.findIndex((item) => item.code === priorCode);
    state.machineTypes[index] = record;
  } else state.machineTypes.push(record);
  commit();
  toast(`${code} 已保存`);
  location.hash = '#/machines';
}

function clearTypePreview() {
  pendingTypePreview = null;
  const formId = specFormId();
  if (formId) {
    pullSpecs();
    formCache = rememberForm(formId);
  }
  notice = '';
  render();
}

async function setTypePreview(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  let dataUrl = '';
  try {
    dataUrl = await shrinkImage(file);
  } catch {
    toast('這張圖片未能讀取，請換一張再試');
    return;
  }
  if (dataUrl.length > 700000) {
    toast('這張圖片太大，請換較小的再試');
    return;
  }
  pendingTypePreview = { name: file.name, dataUrl };
  const formId = specFormId();
  if (formId) {
    pullSpecs();
    formCache = rememberForm(formId);
  }
  notice = '';
  render();
}

async function removeType(code) {
  const type = machineTypeByCode(code);
  if (!type) return;
  if (state.machines.some((item) => item.type === code)) {
    toast('仍有機械使用這個種類，不能刪除');
    return;
  }
  const ok = await ask('刪除這個種類', `${type.code} ${type.name} 會從種類名單移除。`, '刪除這個種類');
  if (!ok) return;
  state.machineTypes = state.machineTypes.filter((item) => item.code !== code);
  commit();
  toast('已刪除');
  location.hash = '#/machines';
}

function saveEngine(button) {
  pullSpecs();
  const data = readForm('engine-form');
  const id = button.dataset.id;
  const prior = engineById(id);
  let code = String(data.code || '').trim().toUpperCase();
  if (!code) code = nextEngineCode();
  if (!/^EN\d+$/.test(code)) return failNote('編號要用 EN 加號碼，例如 EN04。', data);
  if (state.engines.some((item) => item.code === code && item.id !== id)) return failNote('這個編號已經用過。', data);
  for (const key of ['manufacturer', 'model', 'serial']) {
    if (!String(data[key] || '').trim()) return failNote('廠商、型號和序列號都要填。', data);
  }
  const year = Number(data.yearMade);
  if (!Number.isInteger(year) || year < 1970 || year > 2035) return failNote('請填寫出廠年份。', data);
  const hours = Number(data.hours);
  if (!Number.isFinite(hours) || hours < 0) return failNote('請填寫累計運行機鐘。', data);
  const oilRaw = String(data.oilHours ?? '').trim();
  const oilHours = oilRaw === '' ? '' : Number(oilRaw);
  if (oilHours !== '' && (!Number.isFinite(oilHours) || oilHours <= 0)) return failNote('機油更換週期要填小時，或留空。', data);
  const specList = [];
  for (const row of specRows) {
    const label = row.label.trim();
    const value = row.value.trim();
    const unit = row.unit.trim();
    if (!label && !value && !unit) continue;
    if (!label) return failNote('請為每一項規格填名稱，或刪掉空白項。', data);
    specList.push({ label, value, unit });
  }
  const record = {
    id: prior?.id || newId('e-'),
    code,
    manufacturer: data.manufacturer.trim(),
    model: data.model.trim(),
    serial: data.serial.trim(),
    yearMade: year,
    hours,
    specList,
    fuel: String(data.fuel || '').trim(),
    emission: String(data.emission || '').trim(),
    oilHours: data.oilHours === '' || data.oilHours == null ? '' : oilHours,
    mountedMachineId: prior?.mountedMachineId || '',
  };
  if (prior) Object.assign(prior, record);
  else state.engines.push(record);
  commit();
  toast(`${code} 已保存`);
  location.hash = `#/engines/${code}`;
}

async function removeEngine(id) {
  const engine = engineById(id);
  if (!engine) return;
  if (engine.mountedMachineId) {
    toast('這台引擎仍安裝在機械上，先拆卸才能刪除');
    return;
  }
  if (engineIsRepairing(engine, state.repairs) || state.repairs.some((item) => item.assetKind === 'engine' && item.engineId === id)) {
    toast('這台引擎仍有維修紀錄，不能刪除');
    return;
  }
  const ok = await ask('刪除這台引擎', `${engine.code} 會從名冊移除。`, '刪除這台引擎');
  if (!ok) return;
  state.engines = state.engines.filter((item) => item.id !== id);
  commit();
  toast('已刪除');
  location.hash = '#/engines';
}

function mountEngine(button) {
  const engine = engineById(button.dataset.id);
  const data = readForm('mount-form');
  const machine = machineById(data.hostId);
  const type = machineTypeByCode(machine?.type);
  const check = canMount({
    engine,
    machine,
    type,
    engines: state.engines,
    repairing: engineIsRepairing(engine, state.repairs),
  });
  if (!check.ok) {
    toast(check.reason);
    return;
  }
  engine.mountedMachineId = machine.id;
  state.engineTrail.push(trailRow('install', engine, machine, 0));
  commit();
  toast(`${engine.code} 已安裝於 ${machine.code}`);
  render();
}

async function unmountEngine(id) {
  const engine = engineById(id);
  const machine = machineById(engine?.mountedMachineId);
  if (!engine || !machine) return;
  const ok = await ask('拆卸引擎', `${engine.code} 會從 ${machine.code} 拆下，回到庫存。`, '拆卸');
  if (!ok) return;
  engine.mountedMachineId = '';
  state.engineTrail.push(trailRow('remove', engine, machine, 0));
  commit();
  toast(`${engine.code} 已拆卸`);
  render();
}

function trailRow(kind, engine, machine, delta) {
  return {
    id: newId('et-'),
    at: trailStamp(),
    kind,
    actorId: currentUserId(),
    engineId: engine.id,
    engineCode: engine.code,
    machineId: machine?.id || '',
    machineCode: machine?.code || '',
    engineHours: Number(engine.hours) || 0,
    machineHours: Number(machine?.hours) || 0,
    delta,
  };
}

async function addPhoto(input) {
  const files = [...(input.files || [])];
  const machine = machineById(input.dataset.photoFor);
  input.value = '';
  if (!files.length || !machine) return;
  const added = [];
  let skipped = 0;
  for (const file of files) {
    let dataUrl = '';
    try {
      dataUrl = await shrinkImage(file);
    } catch {
      skipped += 1;
      continue;
    }
    if (dataUrl.length > 700000) {
      skipped += 1;
      continue;
    }
    added.push({ id: uid('ph-'), name: file.name, dataUrl });
  }
  if (!added.length) {
    toast(files.length === 1 ? '這張圖片未能讀取，請換較小的再試' : '這些圖片都未能加入，請換較小的再試');
    return;
  }
  if (!Array.isArray(machine.photos)) machine.photos = [];
  const previous = machine.photos;
  machine.photos = previous.concat(added);
  try {
    commit();
  } catch {
    machine.photos = previous;
    toast('圖片太多，這部瀏覽器存不下');
    return;
  }
  toast(skipped ? `已加入 ${added.length} 張，${skipped} 張未能加入` : `已加入 ${added.length} 張`);
  render();
}

async function addLibraryPhoto(input) {
  const files = [...(input.files || [])];
  const machine = machineById(input.dataset.libraryFor);
  const form = document.getElementById('library-form');
  const data = form ? readForm('library-form') : {};
  input.value = '';
  if (!files.length || !machine) return;
  const takenOn = String(data.takenOn || '').trim();
  const note = String(data.note || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) {
    toast('請先填寫拍攝日期');
    return;
  }
  if (!note) {
    toast('請先填寫這批圖片的說明');
    return;
  }
  const added = [];
  let skipped = 0;
  for (const file of files) {
    let dataUrl = '';
    try {
      dataUrl = await shrinkImage(file);
    } catch {
      skipped += 1;
      continue;
    }
    if (dataUrl.length > 700000) {
      skipped += 1;
      continue;
    }
    added.push({ id: uid('lib-'), name: file.name, dataUrl, takenOn, note });
  }
  if (!added.length) {
    toast(files.length === 1 ? '這張圖片未能讀取，請換較小的再試' : '這些圖片都未能加入，請換較小的再試');
    return;
  }
  if (!Array.isArray(machine.library)) machine.library = [];
  const previous = machine.library;
  machine.library = previous.concat(added);
  try {
    commit();
  } catch {
    machine.library = previous;
    toast('圖片太多，這部瀏覽器存不下');
    return;
  }
  toast(skipped ? `已加入 ${added.length} 張，${skipped} 張未能加入` : `已加入 ${added.length} 張`);
  render();
}

function stepPhoto(machineId, dir, reopen, source) {
  const machine = machineById(machineId);
  if (!machine) return;
  if (source === 'library') {
    const photos = libraryOf(machine);
    const current = photoFocus[`${machineId}:library`];
    let index = photos.findIndex((item) => item.id === current);
    if (index < 0) index = 0;
    const next = index + Number(dir);
    if (next < 0 || next >= photos.length) return;
    photoFocus[`${machineId}:library`] = photos[next].id;
    if (reopen) previewLibrary(machineId, photos[next].id);
    return;
  }
  const photos = machine.photos;
  if (!photos.length) return;
  const current = photoFocus[machineId];
  let index = photos.findIndex((item) => item.id === current);
  if (index < 0) index = 0;
  const next = index + Number(dir);
  if (next < 0 || next >= photos.length) return;
  photoFocus[machineId] = photos[next].id;
  render();
  if (reopen) previewPhoto(machineId, photos[next].id);
}

function previewPhoto(machineId, photoId) {
  const machine = machineById(machineId);
  const photos = machine?.photos || [];
  const index = photos.findIndex((item) => item.id === photoId);
  const photo = index >= 0 ? photos[index] : photos[0];
  if (!photo) return;
  photoFocus[machineId] = photo.id;
  const at = photos.findIndex((item) => item.id === photo.id);
  const step = photos.length > 1 ? `
    <button class="ef-btn small" type="button" data-act="photo-step" data-id="${esc(machine.id)}" data-dir="-1" data-view="1"${at === 0 ? ' disabled' : ''}>上一張</button>
    <span class="ef-field">${at + 1} / ${photos.length}</span>
    <button class="ef-btn small" type="button" data-act="photo-step" data-id="${esc(machine.id)}" data-dir="1" data-view="1"${at === photos.length - 1 ? ' disabled' : ''}>下一張</button>` : '';
  const cover = at === 0
    ? '<span class="ef-field">主預覽</span>'
    : `<button class="ef-btn small" type="button" data-act="make-cover" data-id="${esc(machine.id)}" data-photo="${esc(photo.id)}">設為主預覽</button>`;
  openPreview(photo.name || '預覽圖', photo.dataUrl, 'image/jpeg', `
    ${step}
    ${cover}
    <button class="ef-btn danger" type="button" data-act="delete-photo" data-id="${esc(machine.id)}" data-photo="${esc(photo.id)}">移除預覽圖</button>`);
}

function previewLibrary(machineId, photoId) {
  const machine = machineById(machineId);
  const photos = libraryOf(machine);
  const index = photos.findIndex((item) => item.id === photoId);
  if (index < 0) return;
  const photo = photos[index];
  photoFocus[`${machineId}:library`] = photo.id;
  const step = photos.length > 1 ? `
    <button class="ef-btn small" type="button" data-act="photo-step" data-source="library" data-id="${esc(machine.id)}" data-dir="-1" data-view="1"${index === 0 ? ' disabled' : ''}>上一張</button>
    <span class="ef-field">${index + 1} / ${photos.length}</span>
    <button class="ef-btn small" type="button" data-act="photo-step" data-source="library" data-id="${esc(machine.id)}" data-dir="1" data-view="1"${index === photos.length - 1 ? ' disabled' : ''}>下一張</button>` : '';
  const when = photo.takenOn ? photo.takenOn.replaceAll('-', '.') : '未記日期';
  openPreview(photo.note || photo.name || '圖片', photo.dataUrl, 'image/jpeg', `
    <p class="ef-field">${esc(when)}</p>
    ${step}
    <button class="ef-btn danger" type="button" data-act="delete-library" data-id="${esc(machine.id)}" data-photo="${esc(photo.id)}">從圖片庫移除</button>`);
}

function libraryOf(machine) {
  return (machine?.library || []).slice().sort((a, b) => String(b.takenOn).localeCompare(String(a.takenOn)) || String(b.id).localeCompare(String(a.id)));
}

function makeCover(machineId, photoId) {
  const machine = machineById(machineId);
  const photos = machine?.photos || [];
  const index = photos.findIndex((item) => item.id === photoId);
  if (index <= 0) return;
  const [photo] = photos.splice(index, 1);
  photos.unshift(photo);
  commit();
  toast('已設為主預覽');
  render();
  const dialog = document.getElementById('preview');
  if (dialog?.open) previewPhoto(machineId, photo.id);
}

function removePhoto(machineId, photoId) {
  const machine = machineById(machineId);
  if (!machine) return;
  machine.photos = machine.photos.filter((item) => item.id !== photoId);
  delete photoFocus[machineId];
  commit();
  toast('已移除預覽圖');
  render();
  const dialog = document.getElementById('preview');
  if (dialog?.open) closeDialog(dialog);
}

function removeLibraryPhoto(machineId, photoId) {
  const machine = machineById(machineId);
  if (!machine) return;
  const photos = libraryOf(machine);
  const index = photos.findIndex((item) => item.id === photoId);
  machine.library = (machine.library || []).filter((item) => item.id !== photoId);
  commit();
  toast('已從圖片庫移除');
  render();
  const dialog = document.getElementById('preview');
  const next = libraryOf(machine)[Math.min(Math.max(index, 0), libraryOf(machine).length - 1)];
  if (dialog?.open && next) previewLibrary(machine.id, next.id);
  else if (dialog?.open) closeDialog(dialog);
}

function savePerson(id) {
  const data = readForm('person-form');
  formCache = data;
  const name = String(data.name || '').trim();
  const title = String(data.title || '').trim();
  if (!name || !title) return failNote('請填寫姓名和職位。');
  if (!ROLES.some((item) => item.code === data.role)) return failNote('請選擇崗位。');
  if (data.reportsTo === id) return failNote('不能把自己設為上司。');
  const otherRoots = state.people.filter((person) => !person.reportsTo && person.id !== id);
  if (!data.reportsTo && otherRoots.length) return failNote('請選擇上司。部門只保留一位最高負責人。');
  const record = {
    id: id || newId('p-'),
    name,
    title,
    role: data.role,
    reportsTo: data.reportsTo,
    company: COMPANIES.includes(data.company) ? data.company : '',
    phone: String(data.phone || '').trim(),
  };
  const prior = personById(id);
  if (prior) Object.assign(prior, record);
  else state.people.push(record);
  commit();
  toast(`${name} 已保存`);
  location.hash = `#/users?person=${record.id}`;
}

function failNote(text, data) {
  if (data) formCache = data;
  notice = flag('注意', text);
  render();
}

async function removePerson(id) {
  const person = personById(id);
  if (!person) return;
  if (descendants(id).size) {
    toast('請先把下屬改派給其他人');
    return;
  }
  const used = state.repairs.some((repair) => repair.sessions.some((session) => staffIdsOf(session).includes(id)));
  if (used) {
    toast('這位人員仍有維修紀錄，不能刪除');
    return;
  }
  const ok = await ask('刪除這位人員', `${person.name} 會從部門移除。`, '刪除這位人員');
  if (!ok) return;
  state.people = state.people.filter((item) => item.id !== id);
  if (currentUserId() === id) setCurrentUser(state.people[0]?.id || '');
  commit();
  toast('已刪除');
  location.hash = '#/users';
}

async function saveCert(button) {
  const data = readForm('cert-form');
  const meta = CERT_FORMS.find((item) => item.code === data.form);
  if (!meta) return failCert(data, '請選擇證書。');
  if (!machineById(data.machineId)) return failCert(data, '請選擇機械。');
  if (!data.number.trim()) return failCert(data, '請填寫證書編號。');
  if (!data.issuedOn) return failCert(data, '請填寫簽發日期。');
  const lead = Number(data.leadDays);
  if (!Number.isFinite(lead) || lead < 0 || lead > 365) return failCert(data, '提前提醒日數請填 0 至 365。');
  const id = button.dataset.id;
  const prior = state.certificates.find((item) => item.id === id);
  let href = prior?.href || '';
  let mime = prior?.mime || '';
  const file = document.querySelector('#cert-form input[type="file"]')?.files?.[0];
  if (file) {
    const stored = await storeFile(file);
    if (!stored) return failCert(data, '檔案太大或未能讀取。請用 1 MB 以內的圖片或 PDF。');
    href = stored.href;
    mime = stored.mime;
  }
  button.setAttribute('aria-busy', 'true');
  const record = {
    id: prior?.id || newId('c-'),
    machineId: data.machineId,
    form: meta.code,
    number: data.number.trim(),
    issuedOn: data.issuedOn,
    expiresOn: data.expiresOn || '',
    leadDays: lead,
    href,
    mime,
  };
  if (prior) Object.assign(prior, record);
  else state.certificates.push(record);
  commit();
  toast('證書已保存');
  location.hash = '#/papers';
}

function failCert(data, text) {
  formCache = data;
  notice = flag('注意', text);
  render();
}

async function removeCert(id) {
  const cert = state.certificates.find((item) => item.id === id);
  if (!cert) return;
  const ok = await ask('刪除這份證書', `${cert.number} 會從名冊移除。`, '刪除這份證書');
  if (!ok) return;
  state.certificates = state.certificates.filter((item) => item.id !== id);
  commit();
  toast('已刪除');
  location.hash = '#/papers';
}

async function saveDoc(button) {
  const data = readForm('doc-form');
  if (!data.title.trim()) return failDoc(data, '請填寫名稱。');
  if (!DOC_KINDS.some((item) => item.code === data.kind)) return failDoc(data, '請選擇類別。');
  const id = button.dataset.id;
  const prior = state.documents.find((item) => item.id === id);
  let href = prior?.href || '';
  let mime = prior?.mime || '';
  const file = document.querySelector('#doc-form input[type="file"]')?.files?.[0];
  if (file) {
    const stored = await storeFile(file);
    if (!stored) return failDoc(data, '檔案太大或未能讀取。請用 1 MB 以內的圖片或 PDF。');
    href = stored.href;
    mime = stored.mime;
  }
  if (!href) return failDoc(data, '請選擇要預覽的檔案。');
  button.setAttribute('aria-busy', 'true');
  const record = {
    id: prior?.id || newId('d-'),
    machineId: data.machineId,
    kind: data.kind,
    title: data.title.trim(),
    href,
    mime,
  };
  if (prior) Object.assign(prior, record);
  else state.documents.push(record);
  commit();
  toast('文件已保存');
  location.hash = '#/papers/docs';
}

function failDoc(data, text) {
  formCache = data;
  notice = flag('注意', text);
  render();
}

async function removeDoc(id) {
  const doc = state.documents.find((item) => item.id === id);
  if (!doc) return;
  const ok = await ask('刪除這份文件', `${doc.title} 會從名冊移除。`, '刪除這份文件');
  if (!ok) return;
  state.documents = state.documents.filter((item) => item.id !== id);
  commit();
  toast('已刪除');
  location.hash = '#/papers/docs';
}

function previewDoc(source, id) {
  const item = source === 'cert'
    ? state.certificates.find((cert) => cert.id === id)
    : state.documents.find((doc) => doc.id === id);
  if (!item?.href) {
    toast('這份還沒有可預覽的檔案');
    return;
  }
  const title = item.title || item.number;
  openPreview(title, item.href, item.mime);
}

function openPreview(title, href, mime, extra = '') {
  const src = safeSrc(href);
  if (!src) {
    toast('這個檔案不能預覽');
    return;
  }
  const pdf = mime === 'application/pdf' || src.startsWith('data:application/pdf');
  const dialog = document.getElementById('preview');
  dialog.innerHTML = `<div class="ef-panel"><h2>${esc(title)}</h2>
    ${pdf ? `<iframe src="${src}" title="${esc(title)}"></iframe>` : `<img src="${src}" alt="${esc(title)}">`}
    <p class="ef-actions">${extra}<button class="ef-btn" type="button" data-close>關閉</button></p></div>`;
  if (!dialog.open) dialog.showModal();
}

async function storeFile(file) {
  if (file.size > 1200000) return null;
  try {
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
      const href = await shrinkImage(file);
      if (href.length > 900000) return null;
      return { href, mime: 'image/jpeg' };
    }
    const href = await readDataUrl(file);
    if (String(href).length > 1600000) return null;
    return { href, mime: file.type || 'application/octet-stream' };
  } catch {
    return null;
  }
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const max = 960;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    image.src = url;
  });
}

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readForm(id) {
  const form = document.getElementById(id);
  return Object.fromEntries(new FormData(form).entries());
}

function rememberForm(id) {
  const data = readForm(id);
  if (id === 'type-form') data.mountsEngine = document.querySelector('#type-form [name="mountsEngine"]')?.checked ? '1' : '';
  return data;
}

function flag(name, text) {
  return `<p class="ef-notice" data-flag="${esc(name)}">${esc(text)}</p>`;
}

function openSheet(html) {
  const dialog = document.getElementById('sheet');
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}

function openMore() {
  openSheet(`<div class="body"><div class="grab"></div>
    <header><span class="ef-pair"><span class="ef-eyebrow slash">More</span><span>更多</span></span></header>
    <button class="ef-act" type="button" data-go="#/fleet"><span>設備總覽</span></button>
    <button class="ef-act" type="button" data-go="#/engines"><span>引擎</span></button>
    <button class="ef-act" type="button" data-go="#/drills"><span>鑽具</span></button>
    <button class="ef-act" type="button" data-go="#/electrical"><span>電器</span></button>
    <button class="ef-act" type="button" data-go="#/tools"><span>地盤工具</span></button>
    <button class="ef-act" type="button" data-go="#/papers"><span>證書及文件</span></button>
    <button class="ef-act" type="button" data-go="#/stores"><span>物資</span></button>
    <button class="ef-act" type="button" data-go="#/dept"><span>部門組織圖</span></button>
    <button class="ef-act" type="button" data-go="#/users"><span>用戶管理</span></button>
    <button class="ef-act" type="button" data-act="theme"><span>切換深淺</span></button>
    <button class="ef-act" type="button" data-close><span>關閉</span></button>
  </div>`);
}

function ask(title, text, confirm) {
  const dialog = document.getElementById('ask');
  dialog.innerHTML = `<div class="ef-panel"><h2>${esc(title)}</h2><p>${esc(text)}</p>
    <p class="ef-actions"><button class="ef-btn danger" type="button" data-close="ok">${esc(confirm)}</button>
    <button class="ef-btn" type="button" data-close>取消</button></p></div>`;
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    if (!dialog.open) dialog.showModal();
  });
}

async function resetAll() {
  const ok = await ask('恢復示例', '這部電腦上改過的機械、維修、證書、文件和人員會被清掉，換回示例。', '清除並恢復示例');
  if (!ok) return;
  resetData();
  Object.assign(state, getState());
  toast('已恢復示例');
  location.hash = '#/';
  render();
}

function flipTheme(event) {
  const html = document.documentElement;
  const isDark = () => html.dataset.theme === 'dark' || (!html.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const apply = () => {
    capture();
    html.dataset.theme = isDark() ? 'light' : 'dark';
    localStorage.setItem('theme', html.dataset.theme);
    const dialog = document.getElementById('sheet');
    if (dialog.open) closeDialog(dialog);
    render();
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !document.startViewTransition) {
    apply();
    return;
  }
  const box = event.currentTarget.getBoundingClientRect();
  const x = event.clientX || box.left + box.width / 2;
  const y = event.clientY || box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  html.classList.add('ef-theming');
  const transition = document.startViewTransition(apply);
  transition.ready.then(() => {
    html.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: Math.max(240, Math.min(600, radius / 3)), easing: 'cubic-bezier(0.7, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
  transition.finished.finally(() => html.classList.remove('ef-theming'));
}

function enableNotify() {
  if (!('Notification' in window)) {
    toast('這部瀏覽器沒有系統通知，提醒仍會留在首頁');
    return;
  }
  Notification.requestPermission().then((permission) => {
    if (permission !== 'granted') {
      toast('未開啟系統通知，提醒仍會留在首頁');
      return;
    }
    state.settings.notified[currentUserId()] = '';
    commit();
    toast('已開啟到期提醒');
    pushNotify();
    render();
  });
}

function pushNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const user = personById(currentUserId());
  if (!user || (user.role !== 'logistics' && user.role !== 'manager')) return;
  const due = dueCertificates(state);
  if (!due.length) return;
  const day = today();
  if (state.settings.notified?.[user.id] === day) return;
  state.settings.notified[user.id] = day;
  commit();
  const note = new Notification('機械部管理系統', { body: `有 ${due.length} 份證書需要安排續期` });
  note.onclick = () => {
    location.hash = '#/papers';
    window.focus();
  };
}
