import { CERT_FORMS, MACHINE_TYPES } from './catalog.js';
import { addDays, today, uid } from './format.js';

const KEY = 'ckw-mech-v1';
const USER_KEY = 'ckw-mech-user';

function certForm(code) {
  return CERT_FORMS.find((item) => item.code === code);
}

function seed() {
  const day = today();
  const year = day.slice(0, 4);
  const people = [
    { id: 'p-chan', name: '陳國華', title: '機械部經理', role: 'manager', phone: '9100 1001', company: '', reportsTo: '' },
    { id: 'p-lee', name: '李婉儀', title: '後勤主管', role: 'logistics', phone: '9100 1002', company: '', reportsTo: 'p-chan' },
    { id: 'p-cheung', name: '張凱晴', title: '證書文員', role: 'logistics', phone: '9100 1003', company: '', reportsTo: 'p-lee' },
    { id: 'p-ho', name: '何志明', title: '倉務員', role: 'logistics', phone: '9100 1004', company: '', reportsTo: 'p-lee' },
    { id: 'p-wong', name: '黃志強', title: '工場主管', role: 'workshop', phone: '9100 1005', company: '', reportsTo: 'p-chan' },
    { id: 'p-chow', name: '周家豪', title: '機修領班', role: 'workshop', phone: '9100 1006', company: '', reportsTo: 'p-wong' },
    { id: 'p-ng', name: '吳俊傑', title: '機修技工', role: 'tech', phone: '9100 1007', company: '', reportsTo: 'p-chow' },
    { id: 'p-lam', name: '林子軒', title: '機修技工', role: 'tech', phone: '9100 1008', company: '', reportsTo: 'p-chow' },
    { id: 'p-ma', name: '馬詠詩', title: '地盤機械主管', role: 'site', phone: '9100 1009', company: '', reportsTo: 'p-chan' },
    { id: 'p-cheng', name: '鄭家樂', title: 'BP 管工', role: 'site', phone: '9100 1010', company: '建榮', reportsTo: 'p-ma' },
    { id: 'p-choi', name: '蔡穎琛', title: 'DTH 管工', role: 'site', phone: '9100 1011', company: '鑽達', reportsTo: 'p-ma' },
    { id: 'p-poon', name: '潘曉彤', title: 'SI 管工', role: 'site', phone: '9100 1012', company: '永峰', reportsTo: 'p-ma' },
  ];

  const machines = [
    machine('CC01', 'CC', '建榮', 'BP', 'Kobelco', 'CKS2500', 'KCX-2500-18442', 2018, 8426, '啟德跑道區', 22.312, 114.202, '維修中', { jibLengthM: '60', flyJibM: '18', counterweightT: '80', swlT: '250' }),
    machine('CC02', 'CC', '鑽達', 'BP', 'Liebherr', 'LR 1300', 'LR1300-09112', 2016, 12040, '屯門第54區', 22.392, 113.968, '在場', { jibLengthM: '54', flyJibM: '12', counterweightT: '50', swlT: '300' }),
    machine('RCD01', 'RCD', '建榮', 'BP', 'Soilmec', 'SR-75', 'SM-2019-441', 2019, 5102, '啟德跑道區', 22.315, 114.205, '在場', { maxDiameterMm: '2500', maxDepthM: '80' }),
    machine('RCD02', 'RCD', '永峰', 'DTH', 'Leffer', 'RCD 2500', 'LF-17-088', 2017, 7340, '將軍澳市中心', 22.308, 114.259, '在場', { maxDiameterMm: '2500', maxDepthM: '70' }),
    machine('OS01', 'OS', '建榮', 'BP', 'Leffer', 'VRM 2000', 'LF-OS-221', 2020, 2860, '沙田石門', 22.388, 114.208, '在場', { casingDiameterMm: '2000', torqueKnm: '420' }),
    machine('OS02', 'OS', '鑽達', 'BP', 'Leffer', 'VRM 1500', 'LF-OS-118', 2015, 9904, '葵涌貨櫃碼頭', 22.345, 114.122, '調遷', { casingDiameterMm: '1500', torqueKnm: '280' }),
    machine('SD01', 'SD', '永峰', 'SI', 'Geomil', 'HT-200', 'GM-21-014', 2021, 1640, '元朗朗屏', 22.447, 114.025, '在場', { maxDepthM: '60', mastHeightM: '18' }),
    machine('SD02', 'SD', '鑽達', 'SI', 'Casagrande', 'C6', 'CG-C6-332', 2014, 11220, '北角糖水道', 22.291, 114.2, '在場', { maxDepthM: '40', mastHeightM: '14' }),
    machine('TD01', 'TD', '建榮', 'General', 'Furukawa', 'HB2000', 'FR-2000-77', 2019, 4300, '觀塘海濱', 22.309, 114.222, '在場', { chiselKg: '1800', impactJ: '4200' }),
    machine('TD02', 'TD', '鑽達', 'BP', 'Epiroc', 'HB 3100', 'AC-3100-19', 2018, 3888, '屯門第54區', 22.395, 113.972, '在場', { chiselKg: '3100', impactJ: '6100' }),
    machine('AC01', 'AC', '永峰', 'General', 'Atlas Copco', 'XAHS 186', 'AC-XA-552', 2022, 980, '東涌東', 22.289, 113.955, '維修中', { airflow: '10.6', pressureKpa: '1200' }),
    machine('AC02', 'AC', '建榮', 'General', 'Sullair', '900H', 'SU-900-304', 2016, 6402, '屯門工場', 22.385, 113.964, '停用', { airflow: '25.5', pressureKpa: '1000' }),
  ];

  const repairs = [
    {
      id: 'r-cc01',
      number: `WR-${year}-014`,
      machineId: 'm-cc01',
      status: 'open',
      openedOn: addDays(day, -2),
      closedOn: '',
      sessions: [
        {
          id: 's-cc01-a',
          date: addDays(day, -2),
          location: '啟德跑道區',
          staffId: 'p-ng',
          start: '08:00',
          end: '18:00',
          type: '突發維修',
          fault: '主卷揚制動時有異響。',
          process: '拆檢制動器，來令片已磨損，當日未有配件可換。',
          parts: [],
        },
        {
          id: 's-cc01-b',
          date: addDays(day, -1),
          location: '啟德跑道區',
          staffId: 'p-ng',
          start: '09:00',
          end: '13:30',
          type: '突發維修',
          fault: '主卷揚制動時有異響。',
          process: '更換來令片後試機，仍有輕微異響，留待下次續查。',
          parts: [{ name: '來令片', qty: '2', partNo: 'BR-440' }],
        },
      ],
    },
    {
      id: 'r-rcd01',
      number: `WR-${year}-015`,
      machineId: 'm-rcd01',
      status: 'done',
      openedOn: addDays(day, -7),
      closedOn: addDays(day, -7),
      sessions: [
        {
          id: 's-rcd01',
          date: addDays(day, -7),
          location: '啟德跑道區',
          staffId: 'p-lam',
          start: '08:00',
          end: '19:30',
          type: '保養',
          fault: '',
          process: '按保養表更換機油及濾芯，試機正常。',
          parts: [
            { name: '機油濾芯', qty: '1', partNo: 'OF-75' },
            { name: '液壓油', qty: '20', partNo: 'HY-46' },
          ],
        },
      ],
    },
    {
      id: 'r-td01',
      number: `WR-${year}-016`,
      machineId: 'm-td01',
      status: 'done',
      openedOn: addDays(day, -4),
      closedOn: addDays(day, -4),
      sessions: [
        {
          id: 's-td01',
          date: addDays(day, -4),
          location: '觀塘海濱',
          staffId: 'p-chow',
          start: '14:00',
          end: '17:00',
          type: '檢查',
          fault: '',
          process: '檢查釬杆固定及潤滑，未發現需要停機的項目。',
          parts: [],
        },
      ],
    },
    {
      id: 'r-ac01',
      number: `WR-${year}-017`,
      machineId: 'm-ac01',
      status: 'open',
      openedOn: day,
      closedOn: '',
      sessions: [
        {
          id: 's-ac01',
          date: day,
          location: '東涌東',
          staffId: 'p-lam',
          start: '07:30',
          end: '11:00',
          type: '檢查',
          fault: '出風不穩。',
          process: '清潔進氣濾網。濾芯未到貨，這次先收工。',
          parts: [],
        },
      ],
    },
    {
      id: 'r-en03',
      number: `WR-${year}-018`,
      machineId: '',
      engineId: 'e-en03',
      assetKind: 'engine',
      status: 'open',
      openedOn: day,
      closedOn: '',
      sessions: [
        {
          id: 's-en03',
          date: day,
          location: '屯門工場',
          staffId: 'p-ng',
          start: '09:00',
          end: '12:00',
          type: '突發維修',
          fault: '起動困難，起動馬達空轉。',
          process: '拆檢起動馬達，碳刷已短。新件未到，這次先收工。',
          parts: [],
        },
      ],
    },
    {
      id: 'r-sd02',
      number: `WR-${year}-013`,
      machineId: 'm-sd02',
      status: 'done',
      openedOn: addDays(day, -24),
      closedOn: addDays(day, -24),
      sessions: [
        {
          id: 's-sd02',
          date: addDays(day, -24),
          location: '北角糖水道',
          staffId: 'p-ng',
          start: '16:00',
          end: '20:00',
          type: '突發維修',
          fault: '桅杆油缸漏油。',
          process: '更換油封並補油，試升降正常。',
          parts: [{ name: '油封', qty: '1', partNo: 'OR-90' }],
        },
      ],
    },
  ];

  const certificates = [
    cert('c-cc01-f5', 'm-cc01', 'F5', `LALG-F5-${year}-018`, addDays(day, -354), addDays(day, 11)),
    cert('c-cc01-f1', 'm-cc01', 'F1', `LALG-F1-${year}-221`, addDays(day, -5), addDays(day, 2)),
    cert('c-cc01-nrmm', 'm-cc01', 'NRMM', 'NRMM-88421', addDays(day, -400), addDays(day, 39)),
    cert('c-cc02-f5', 'm-cc02', 'F5', `LALG-F5-${year}-004`, addDays(day, -200), addDays(day, 165)),
    cert('c-cc02-qpme', 'm-cc02', 'QPME', 'QPME-22018', addDays(day, -500), addDays(day, -4)),
    cert('c-rcd-nrmm', 'm-rcd01', 'NRMM', 'NRMM-19077', addDays(day, -100), addDays(day, 420)),
    cert('c-os-qpme', 'm-os01', 'QPME', 'QPME-31002', addDays(day, -20), addDays(day, 40)),
    cert('c-ac-nrmm', 'm-ac01', 'NRMM', 'NRMM-55201', addDays(day, -80), addDays(day, 8)),
    cert('c-sd-nrmm', 'm-sd01', 'NRMM', 'NRMM-01488', addDays(day, -30), addDays(day, 200)),
  ];

  const documents = [
    { id: 'd-cc-manual', machineId: 'm-cc01', kind: 'manual', title: 'CKS2500 操作摘錄', href: 'samples/manual-cc01.svg', mime: 'image/svg+xml' },
    { id: 'd-cc-oil', machineId: 'm-cc01', kind: 'oil', title: 'CKS2500 油路圖', href: 'samples/oil-cc01.svg', mime: 'image/svg+xml' },
    { id: 'd-cc-circuit', machineId: 'm-cc01', kind: 'circuit', title: 'CKS2500 電路圖', href: 'samples/circuit-cc01.svg', mime: 'image/svg+xml' },
    { id: 'd-rcd-cat', machineId: 'm-rcd01', kind: 'catalog', title: 'SR-75 產品冊摘頁', href: 'samples/catalog-rcd01.svg', mime: 'image/svg+xml' },
  ];

  const notices = [
    {
      id: 'n-parts',
      date: day,
      title: 'CC01 制動器配件已到工場',
      body: '來令片已入倉。啟德的續做請聯絡機修領班。',
      authorId: 'p-ho',
    },
    {
      id: 'n-stock',
      date: addDays(day, -1),
      title: '本週五工場盤點',
      body: '屯門工場 16:00 停止領料，盤點後再開放。',
      authorId: 'p-lee',
    },
    {
      id: 'n-form',
      date: addDays(day, -3),
      title: '表格一週檢請在到期前交回',
      body: '履帶吊機的每週檢查由後勤跟進，地盤管工請預留停機時間。',
      authorId: 'p-cheung',
    },
  ];

  const alerts = [
    { id: 'a-zone', title: '吊運範圍內不准站人', body: '吊臂、配重和貨荷經過的地方要清空，訊號員留在指揮位置。' },
    { id: 'a-wind', title: '風力達到限制就停止吊運', body: '履帶吊機按該機的風力限制收桿，並通知地盤機械主管。' },
    { id: 'a-lock', title: '維修未完成不得交回操作', body: '掛牌留在機械上，直到該項維修紀錄標為完成。' },
  ];

  const engines = [
    {
      id: 'e-en01',
      code: 'EN01',
      manufacturer: 'Cummins',
      model: 'QSB6.7',
      serial: 'CM-67-44120',
      yearMade: 2019,
      hours: 4200,
      specList: [
        { label: '功率', value: '129', unit: 'kW' },
        { label: '排量', value: '6.7', unit: 'L' },
      ],
      mountedMachineId: '',
      fuel: '柴油',
      emission: 'Tier 3',
      oilHours: 500,
    },
    {
      id: 'e-en02',
      code: 'EN02',
      manufacturer: 'Liebherr',
      model: 'D946',
      serial: 'LB-946-2201',
      yearMade: 2016,
      hours: 9800,
      specList: [{ label: '功率', value: '270', unit: 'kW' }],
      mountedMachineId: 'm-cc02',
      fuel: '柴油',
      emission: 'Tier 4',
      oilHours: 500,
    },
    {
      id: 'e-en03',
      code: 'EN03',
      manufacturer: 'Kubota',
      model: 'V3800',
      serial: 'KB-3800-118',
      yearMade: 2021,
      hours: 1560,
      specList: [{ label: '功率', value: '65', unit: 'kW' }],
      mountedMachineId: '',
      fuel: '柴油',
      emission: 'Tier 4',
      oilHours: 250,
    },
  ];

  const engineTrail = [
    {
      id: 'et-en02-install',
      at: `${addDays(day, -40)} 09:15`,
      kind: 'install',
      actorId: 'p-chow',
      engineId: 'e-en02',
      engineCode: 'EN02',
      machineId: 'm-cc02',
      machineCode: 'CC02',
      engineHours: 9800,
      machineHours: 12040,
      delta: 0,
    },
  ];

  return normalize({
    people,
    machines,
    repairs,
    certificates,
    documents,
    notices,
    alerts,
    settings: { notified: {} },
    machineTypes: machineTypeSeed(),
    engines,
    engineTrail,
    hourLogs: [],
  });
}

function machineTypeSeed() {
  return MACHINE_TYPES.map((type) => ({
    code: type.code,
    name: type.name,
    short: type.short,
    mountsEngine: Boolean(type.mountsEngine),
    fields: type.fields.map((field) => ({
      key: field.key,
      label: field.label,
      unit: field.unit,
    })),
  }));
}

function normalize(data) {
  for (const repair of data.repairs || []) {
    if (!repair.assetKind) repair.assetKind = 'machine';
    if (repair.engineId == null) repair.engineId = '';
    for (const session of repair.sessions || []) {
      if (!Array.isArray(session.staffIds) || !session.staffIds.length) {
        session.staffIds = session.staffId ? [session.staffId] : [];
      }
    }
  }
  return data;
}

export function staffIdsOf(session) {
  if (Array.isArray(session?.staffIds) && session.staffIds.length) return session.staffIds;
  return session?.staffId ? [session.staffId] : [];
}

function machine(code, type, company, discipline, manufacturer, model, serial, yearMade, hours, site, lat, lng, status, specs) {
  return {
    id: `m-${code.toLowerCase()}`,
    code,
    type,
    company,
    discipline,
    manufacturer,
    model,
    serial,
    yearMade,
    hours,
    site,
    lat,
    lng,
    status,
    specs,
    photos: [],
    library: [],
  };
}

function cert(id, machineId, form, number, issuedOn, expiresOn) {
  const meta = certForm(form);
  return {
    id,
    machineId,
    form,
    number,
    issuedOn,
    expiresOn,
    leadDays: meta?.lead ?? 30,
    href: '',
    mime: '',
  };
}

function load() {
  let data = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch {
    /* keep the sample set if storage is unreadable */
  }
  if (!data) {
    data = seed();
    persist(data);
    return data;
  }
  const sample = seed();
  let changed = false;
  if (!Array.isArray(data.notices)) {
    data.notices = sample.notices;
    changed = true;
  }
  if (!Array.isArray(data.alerts)) {
    data.alerts = sample.alerts;
    changed = true;
  }
  if (!Array.isArray(data.machineTypes)) {
    data.machineTypes = sample.machineTypes;
    changed = true;
  }
  if (!Array.isArray(data.engines)) {
    data.engines = sample.engines;
    data.engineTrail = sample.engineTrail;
    const engineRepair = sample.repairs.find((item) => item.id === 'r-en03');
    if (engineRepair && Array.isArray(data.repairs) && !data.repairs.some((item) => item.id === engineRepair.id)) {
      const copy = JSON.parse(JSON.stringify(engineRepair));
      copy.number = repairNumberAfter(data.repairs);
      data.repairs.push(copy);
    }
    changed = true;
  } else if (!Array.isArray(data.engineTrail)) {
    data.engineTrail = [];
    changed = true;
  }
  if (!Array.isArray(data.hourLogs)) {
    data.hourLogs = [];
    changed = true;
  }
  if (Array.isArray(data.engines)) {
    for (const engine of data.engines) {
      const sampleEngine = sample.engines.find((item) => item.id === engine.id);
      if (!sampleEngine) continue;
      if (engine.fuel == null) {
        engine.fuel = sampleEngine.fuel || '';
        changed = true;
      }
      if (engine.emission == null) {
        engine.emission = sampleEngine.emission || '';
        changed = true;
      }
      if (engine.oilHours == null) {
        engine.oilHours = sampleEngine.oilHours ?? '';
        changed = true;
      }
    }
  }
  if (Array.isArray(data.repairs)) {
    for (const repair of data.repairs) {
      if (!repair.assetKind) {
        repair.assetKind = 'machine';
        changed = true;
      }
      if (repair.engineId == null) {
        repair.engineId = '';
        changed = true;
      }
    }
  }
  if (Array.isArray(data.machines)) {
    for (const machine of data.machines) {
      if (!Array.isArray(machine.photos)) {
        machine.photos = [];
        changed = true;
      }
      if (!Array.isArray(machine.library)) {
        const extra = machine.photos.slice(1);
        machine.library = extra.map((photo) => ({
          id: photo.id,
          name: photo.name || '',
          dataUrl: photo.dataUrl,
          takenOn: '',
          note: photo.name || '',
        }));
        if (machine.photos.length > 1) machine.photos = machine.photos.slice(0, 1);
        changed = true;
      }
    }
  }
  if (changed) persist(data);
  return data;
}

function persist(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

let state = null;

export function init() {
  state = load();
  return state;
}

export function getState() {
  return state;
}

export function commit() {
  persist(state);
}

export function resetData() {
  const fresh = seed();
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh);
  persist(state);
  return state;
}

export function currentUserId() {
  try {
    const saved = localStorage.getItem(USER_KEY);
    if (saved && state.people.some((person) => person.id === saved)) return saved;
  } catch {
    /* fall through */
  }
  return 'p-chan';
}

export function setCurrentUser(id) {
  localStorage.setItem(USER_KEY, id);
}

export function personById(id) {
  return state.people.find((person) => person.id === id) || null;
}

export function machineById(id) {
  return state.machines.find((item) => item.id === id) || null;
}

export function machineByCode(code) {
  return state.machines.find((item) => item.code === code) || null;
}

export function machineTypeByCode(code) {
  return state.machineTypes.find((item) => item.code === code) || null;
}

export function engineById(id) {
  return state.engines.find((item) => item.id === id) || null;
}

export function engineByCode(code) {
  return state.engines.find((item) => item.code === code) || null;
}

export function repairByNumber(number) {
  return state.repairs.find((item) => item.number === number) || null;
}

export function nextMachineCode(type) {
  const nums = state.machines
    .filter((item) => item.type === type)
    .map((item) => Number(item.code.slice(type.length)))
    .filter((n) => Number.isInteger(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${type}${String(next).padStart(2, '0')}`;
}

function repairNumberAfter(repairs) {
  const year = today().slice(0, 4);
  const re = new RegExp(`^WR-${year}-(\\d+)$`);
  let max = 0;
  for (const repair of repairs || []) {
    const match = re.exec(repair.number);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `WR-${year}-${String(max + 1).padStart(3, '0')}`;
}

export function nextRepairNumber() {
  return repairNumberAfter(state.repairs);
}

export function nextEngineCode() {
  const nums = state.engines
    .map((item) => Number(/^EN(\d+)$/.exec(item.code)?.[1]))
    .filter((n) => Number.isInteger(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `EN${String(next).padStart(2, '0')}`;
}

export function descendants(id) {
  const out = new Set();
  const walk = (parent) => {
    for (const person of state.people.filter((item) => item.reportsTo === parent)) {
      out.add(person.id);
      walk(person.id);
    }
  };
  walk(id);
  return out;
}

export function newId(prefix) {
  return uid(prefix);
}
