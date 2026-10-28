import {
  CERT_FORMS,
  COMPANIES,
  DISCIPLINES,
  DOC_KINDS,
  REPAIR_TYPES,
  ROLES,
  STATUSES,
} from './catalog.js';
import { engineIsRepairing, engineStatusCode, engineStatusText, meterPunch } from './engines.js';
import {
  certTiming,
  esc,
  fmtDate,
  fmtMinutes,
  repairTotals,
  splitShift,
  today,
} from './format.js';
import { machineById, nextEngineCode, nextMachineCode, personById, staffIdsOf } from './store.js';

let liveTypes = [];

const STEPS = ['類型', '設備', '紀錄'];

export function fleetDial(state) {
  const types = state.machineTypes?.length ? state.machineTypes : [{ code: '—', short: '—', name: '沒有種類' }];
  const sections = types.map((type) => {
    const rows = state.machines.filter((item) => item.type === type.code);
    return {
      zh: type.short,
      en: type.code,
      href: `#/machines/type/${type.code}`,
      big: rows.length,
      unit: '台',
      sub: type.name,
      alert: rows.some((item) => item.status === '維修中'),
    };
  });
  const repairing = state.machines.filter((item) => item.status === '維修中').length;
  const due = dueCertificates(state).length;
  return {
    idle: { label: '在冊機械', big: state.machines.length, unit: '台', sub: fmtDate(today()) },
    gauges: [
      { label: '維修中', share: state.machines.length ? repairing / state.machines.length : 0 },
      { label: '證書到期', share: state.certificates.length ? due / state.certificates.length : 0 },
    ],
    sections,
  };
}

export function dueCertificates(state) {
  return state.certificates
    .map((cert) => ({ cert, timing: certTiming(cert) }))
    .filter((item) => item.timing.state === 'due' || item.timing.state === 'expired')
    .sort((a, b) => a.timing.days - b.timing.days);
}

export function renderRoute(route, extras) {
  const [section, id, action] = route.parts;
  const { state } = extras;
  liveTypes = state.machineTypes || [];
  if (!section) return renderOverview(state, extras);
  if (section === 'fleet') return renderFleet(state);
  if (section === 'machines' && id === 'types') {
    if (!action || action === 'new') return renderTypeForm(state, null, extras);
    const type = liveTypes.find((item) => item.code === action);
    if (!type) return missingRecord('機械種類', '#/machines');
    return renderTypeForm(state, type, extras);
  }
  if (section === 'machines' && id === 'type') {
    const type = liveTypes.find((item) => item.code === action);
    if (!type) return missingRecord('機械種類', '#/machines');
    return renderMachineCodes(state, type, route.query, extras);
  }
  if (section === 'machines' && id === 'new') return renderMachineForm(state, null, extras);
  if (section === 'machines' && action === 'edit') return renderMachineForm(state, findCode(state, id), extras);
  if (section === 'machines' && id) return renderMachine(state, findCode(state, id), extras.photoId);
  if (section === 'machines' && route.query.type) {
    const type = liveTypes.find((item) => item.code === route.query.type);
    if (type) return renderMachineCodes(state, type, route.query, extras);
  }
  if (section === 'machines' && route.query.status) {
    return renderMachineCodes(state, null, route.query, extras);
  }
  if (section === 'machines') return renderTypeIndex(state, route.query);
  if (section === 'engines' && id === 'new') return renderEngineForm(state, null, extras);
  if (section === 'engines' && action === 'edit') return renderEngineForm(state, findEngine(state, id), extras);
  if (section === 'engines' && id) return renderEngine(state, findEngine(state, id));
  if (section === 'engines') return renderEngineList(state, route.query, extras);
  if (section === 'repairs' && id === 'new') return renderRepairForm(state, extras);
  if (section === 'repairs' && action === 'session') return renderRepairForm(state, extras);
  if (section === 'repairs' && action === 'edit') return renderRepairEdit(state, extras);
  if (section === 'repairs' && id) {
    const repair = state.repairs.find((item) => item.number === id) || null;
    if (repair?.status === 'draft') {
      if (repair.ownerId !== extras.user?.id) return missingRecord('維修', '#/repairs');
      return renderRepairForm(state, extras);
    }
    return renderRepair(state, repair);
  }
  if (section === 'repairs') return renderRepairList(state, route.query, extras);
  if (section === 'hours') return renderHourForm(state, extras);
  if (section === 'map') return renderMapPage(state, route.query.at || '');
  if (section === 'papers' && id === 'cert') return renderCertForm(state, action === 'new' ? null : state.certificates.find((item) => item.id === action), extras);
  if (section === 'papers' && id === 'doc') return renderDocForm(state, action === 'new' ? null : state.documents.find((item) => item.id === action), extras);
  if (section === 'papers') return renderPapers(state, route, extras);
  if (section === 'dept') return renderDept(state);
  if (section === 'users') return renderUsers(state, route.query, extras);
  if (section === 'drills') return renderLater('鑽具', 'Drilling tool', '鑽具登記稍後開放。');
  if (section === 'electrical') return renderLater('電器', 'Electrical equipment', '電器登記稍後開放。');
  if (section === 'tools') return renderLater('地盤工具', 'Site tool', '地盤工具登記稍後開放。');
  if (section === 'stores') return renderStores();
  return renderMissing();
}

export function renderAlertSheet(state) {
  const rows = dueCertificates(state);
  const logistics = state.people.filter((person) => person.role === 'logistics').map((person) => person.name);
  const body = rows.length
    ? `<ul class="ef-records">${rows.map(({ cert, timing }) => {
        const machine = machineById(cert.machineId);
        const form = CERT_FORMS.find((item) => item.code === cert.form);
        const when = timing.state === 'expired' ? `已過期 ${Math.abs(timing.days)} 日` : `還有 ${timing.days} 日`;
        return `<li><a class="ef-record" href="#/papers/cert/${esc(cert.id)}">
          <span class="ef-tag is-current">${esc(form?.name || cert.form)}</span>
          <span class="ef-field">${esc(when)}</span>
          <span class="name">${esc(machine?.code || '—')} ${esc(form?.full || '')}</span>
          <span class="ef-field">${esc(fmtDate(cert.expiresOn))}</span>
        </a></li>`;
      }).join('')}</ul>`
    : '<p class="ef-empty">現時沒有到期或將到期的證書。</p>';
  return `<div class="body"><div class="grab"></div><header><span class="ef-pair"><span class="ef-eyebrow slash">Reminders</span><span>續期提醒</span></span></header>
    <p class="ef-lede" style="padding-inline: var(--ef-pad)">通知對象是後勤：${esc(logistics.join('、'))}。</p>
    ${body}
    <p class="ef-actions"><button class="ef-btn" type="button" data-close>關閉</button></p></div>`;
}

function renderOverview(state) {
  const notices = (state.notices || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const alerts = state.alerts || [];
  const recent = state.repairs
    .filter((item) => item.status !== 'draft')
    .slice()
    .sort((a, b) => latestDate(b).localeCompare(latestDate(a)) || b.number.localeCompare(a.number))
    .slice(0, 5);
  const noticeItems = notices.map((item) => {
    const author = personById(item.authorId);
    return `<li>
      <p class="ef-field">${esc(fmtDate(item.date))}${author ? ` │ ${esc(author.name)}` : ''}</p>
      <p class="name">${esc(item.title)}</p>
      <p>${esc(item.body)}</p>
    </li>`;
  }).join('');
  const alertItems = alerts.map((item) => `<li>
      <p class="name">${esc(item.title)}</p>
      <p>${esc(item.body)}</p>
    </li>`).join('');
  const repairItems = recent.map((repair, index) => repairRecord(state, repair, index === 0)).join('');

  return `<div class="home">
      <p class="ef-crumb"><span>機械部</span><span>首頁</span></p>
      <p class="ef-eyebrow slash">01 / Home</p>
      <h1 class="home-title" tabindex="-1"><span class="ef-marker">今日概況</span></h1>
      <ul class="ef-facts">
        <li class="ef-field">${esc(fmtDate(today()))}</li>
        <li class="ef-field">在冊 ${state.machines.length} 台</li>
        <li class="ef-field">公告 ${notices.length} 則</li>
        <li class="ef-field">近期維修 ${recent.length} 項</li>
      </ul>
      <div class="home-grid">
        <section class="ef-panel home-notices">
          <h2><span class="ef-pair"><span class="ef-eyebrow">Notices</span><span>公告</span></span></h2>
          ${noticeItems ? `<ul class="note-list">${noticeItems}</ul>` : '<p class="ef-empty">還沒有公告。部門通知會列在這裡。</p>'}
        </section>
        <section class="ef-panel home-safety">
          <h2><span class="ef-pair"><span class="ef-eyebrow">Safety</span><span>安全警惕</span></span></h2>
          <div data-live-warn></div>
          ${alertItems ? `<ul class="note-list">${alertItems}</ul>` : '<p class="ef-empty">還沒有安全警惕。</p>'}
        </section>
        <section class="ef-panel home-weather" data-weather>
          <h2><span class="ef-pair"><span class="ef-eyebrow">Forecast</span><span>天氣預報</span></span> <small>香港天文台</small></h2>
          <div data-wx><p class="ef-empty">正在讀取香港天文台的預報。</p></div>
        </section>
        <section class="ef-panel home-repairs">
          <h2><span class="ef-pair"><span class="ef-eyebrow">Repairs</span><span>近期維修</span></span> <a href="#/repairs">全部</a></h2>
          ${repairItems ? `<ul class="ef-records">${repairItems}</ul>` : '<p class="ef-empty">還沒有維修紀錄。填寫之後會出現在這裡。</p>'}
        </section>
      </div>
    </div>`;
}

function renderFleet(state) {
  const machines = state.machines;
  const count = (match) => machines.filter(match).length;
  const companyFigs = COMPANIES.map((company) => {
    const n = count((item) => item.company === company);
    return `<a href="#/machines?company=${encodeURIComponent(company)}"><b>${n}</b><span>${esc(company)}</span></a>`;
  }).join('');
  const onSite = count((item) => item.status === '在場');
  const repairing = count((item) => item.status === '維修中');
  const moving = count((item) => item.status === '調遷');
  const stopped = count((item) => item.status === '停用');
  const disciplineRows = DISCIPLINES.map((item) => `<li><span>${esc(item.code)} ${esc(item.name)}</span><span class="ef-field">${count((machine) => machine.discipline === item.code)} 台</span></li>`).join('');
  const due = dueCertificates(state).slice(0, 4);
  const dueRows = due.map(({ cert, timing }) => {
    const machine = machineById(cert.machineId);
    const when = timing.state === 'expired' ? `已過期 ${Math.abs(timing.days)} 日` : `餘 ${timing.days} 日`;
    return `<li><span>${esc(machine?.code || '—')} ${esc(cert.number)}</span><span class="ef-field warn">${esc(when)}</span></li>`;
  }).join('');
  const hours = machines.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const sites = new Set(machines.map((item) => item.site).filter(Boolean));
  const openRepairs = state.repairs
    .filter((item) => item.status === 'open')
    .sort((a, b) => latestDate(b).localeCompare(latestDate(a)));
  const repairList = openRepairs.length
    ? `<ul class="ef-records">${openRepairs.map((item) => repairRecord(state, item, false)).join('')}</ul>`
    : '<p class="ef-empty">現時沒有進行中的維修。</p>';
  const repairMachines = machines.filter((item) => item.status === '維修中').sort((a, b) => a.code.localeCompare(b.code));
  const machineList = repairMachines.length
    ? `<ul class="ef-records">${repairMachines.map((item) => machineRecord(item, false)).join('')}</ul>`
    : '<p class="ef-empty">現時沒有維修中的機械。</p>';
  return `<div class="fleet">
      <div class="orbit">
        <figure class="hub"><svg class="ef-dial" data-dial role="group" aria-label="機種台數"></svg></figure>
        <section class="ef-panel cut-br l1">
          <h2><span class="ef-pair"><span class="ef-eyebrow">Companies</span><span>公司</span></span></h2>
          <div class="ef-figs">${companyFigs}</div>
        </section>
        <section class="ef-panel cut-bl tab-right r1">
          <h2><span class="ef-pair"><span class="ef-eyebrow">Status</span><span>狀態</span></span></h2>
          <div class="ef-figs">
            <a href="#/machines?status=${encodeURIComponent('在場')}"><b>${onSite}</b><span>在場</span></a>
            <a href="#/machines?status=${encodeURIComponent('維修中')}"${repairing ? ' class="is-alert"' : ''}><b>${repairing}</b><span>維修中</span></a>
            <a href="#/machines?status=${encodeURIComponent('停用')}"><b>${stopped}</b><span>停用</span></a>
          </div>
        </section>
        <section class="ef-panel lead-right l2">
          <h2><span class="ef-pair"><span class="ef-eyebrow">Disciplines</span><span>工程類別</span></span></h2>
          <ul class="ef-ledger">${disciplineRows}</ul>
        </section>
        <section class="ef-panel lead-left tab-right r2">
          <h2><span class="ef-pair"><span class="ef-eyebrow">Certificates</span><span>將到期證書</span></span> <a href="#/papers">全部</a></h2>
          ${dueRows ? `<ul class="ef-ledger">${dueRows}</ul>` : '<p class="ef-empty">現時沒有到期或將到期的證書。</p>'}
        </section>
        <section class="ef-panel cut-tr l3">
          <h2><span class="ef-pair"><span class="ef-eyebrow">Hours</span><span>機鐘</span></span></h2>
          <ul class="ef-ledger">
            <li><span>累計運行</span><span class="ef-field">${hours.toLocaleString('en-HK')} 小時</span></li>
            <li><span>在冊</span><span class="ef-field">${machines.length} 台</span></li>
          </ul>
        </section>
        <section class="ef-panel cut-tl tab-right r3">
          <h2><span class="ef-pair"><span class="ef-eyebrow">Sites</span><span>地盤</span></span> <a href="#/map">地圖</a></h2>
          <ul class="ef-ledger">
            <li><span>有機械的地盤</span><span class="ef-field">${sites.size} 個</span></li>
            <li><span>調遷</span><span class="ef-field">${moving} 台</span></li>
            <li><span>停用</span><span class="ef-field">${stopped} 台</span></li>
          </ul>
        </section>
      </div>
      <div class="fleet-cols">
        <section class="ef-panel">
          <h2>進行中的維修 <a href="#/repairs">全部</a></h2>
          ${repairList}
        </section>
        <section class="ef-panel">
          <h2>維修中的機械 <a href="#/machines?status=${encodeURIComponent('維修中')}">名冊</a></h2>
          ${machineList}
        </section>
      </div>
    </div>`;
}

function renderTypeIndex(state, query = {}) {
  const matched = (type) => state.machines.filter((item) => item.type === type.code && (!query.company || item.company === query.company) && (!query.discipline || item.discipline === query.discipline));
  const shown = (state.machineTypes || []).filter((type) => !query.company && !query.discipline || matched(type).length);
  const rows = shown.map((type, index) => {
    const count = matched(type).length;
    const keep = new URLSearchParams();
    if (query.company) keep.set('company', query.company);
    if (query.discipline) keep.set('discipline', query.discipline);
    const tail = keep.toString();
    return `<li class="type-line">
      <a class="ef-record" href="#/machines/type/${esc(type.code)}${tail ? `?${tail}` : ''}">
        ${typeMark(type.code, type.preview)}
        <span class="ef-tag${index === 0 ? ' is-current' : ''}">${esc(type.code)}</span>
        <span class="ef-field">${esc(type.short || '')}</span>
        <span class="name">${esc(type.name)}</span>
        <span class="ef-field">${count} 台</span>
      </a>
      <a class="ef-btn small" href="#/machines/types/${esc(type.code)}">編輯</a>
    </li>`;
  }).join('');
  const machines = state.machines.filter((item) => (!query.company || item.company === query.company) && (!query.discipline || item.discipline === query.discipline));
  const countOf = (match) => state.machines.filter(match).length;
  return `${head('機械', 'Machines', `共 ${machines.length} 台`)}
    <p class="ef-actions"><a class="ef-btn" href="#/machines/types/new">新增種類</a></p>
    <p class="ef-lede">先選種類，再選編號。</p>
    ${chipRow('所屬公司', [['', '全部', state.machines.length], ...COMPANIES.map((company) => [company, company, countOf((item) => item.company === company)])], 'company', query.company || '')}
    ${chipRow('工程類別', [['', '全部', state.machines.length], ...DISCIPLINES.map((item) => [item.code, item.code, countOf((machine) => machine.discipline === item.code)])], 'discipline', query.discipline || '')}
    ${rows ? `<ul class="ef-records">${rows}</ul>` : '<p class="ef-empty">沒有符合的機械種類。</p>'}`;
}

function typePreviewOf(type, extras) {
  const pending = extras?.typePreview;
  if (pending === null) return null;
  if (pending?.dataUrl) return pending;
  return type?.preview?.dataUrl ? type.preview : null;
}

function typeMark(code, preview) {
  if (preview?.dataUrl) return `<span class="type-preview"><img src="${esc(preview.dataUrl)}" alt=""></span>`;
  return `<span class="type-preview is-empty">${esc(code || '代號')}</span>`;
}

function renderMachineCodes(state, type, query, extras) {
  let scope = type ? state.machines.filter((item) => item.type === type.code) : state.machines.slice();
  if (query.company) scope = scope.filter((item) => item.company === query.company);
  if (query.discipline) scope = scope.filter((item) => item.discipline === query.discipline);
  let rows = scope.slice();
  if (query.status) rows = rows.filter((item) => item.status === query.status);
  let marked = false;
  const records = rows.slice().sort((a, b) => a.code.localeCompare(b.code)).map((item) => {
    const first = !marked;
    marked = true;
    return machineRecord(item, first);
  }).join('');
  const countOf = (match) => scope.filter(match).length;
  const title = type ? type.name : [query.company, query.discipline, query.status].filter(Boolean).join(' · ') || '機械編號';
  const en = type ? type.code : 'Machines';
  const register = type ? `<a class="ef-btn go" href="#/machines/new?type=${esc(type.code)}">登記機械</a>` : '';
  return `<p class="ef-crumb"><a href="#/machines">機械</a><span>${esc(title)}</span></p>
    ${head(title, en, `${scope.length} 台`)}
    ${register ? `<p class="ef-actions">${register}</p>` : ''}
    ${searchBox('搜尋編號、廠商、型號或地盤', extras.q)}
    ${chipRow('狀態', [['', '全部', scope.length], ...STATUSES.map((status) => [status, status, countOf((item) => item.status === status)])], 'status', query.status || '')}
    <div id="list-slot">${records ? `<ul class="ef-records">${records}</ul>` : ''}</div>
    <p class="ef-empty" id="list-empty" ${records ? 'hidden' : ''}>${type ? '這類還沒有符合的機械。' : '沒有符合條件的機械。'}</p>`;
}

function renderMachine(state, machine, photoId) {
  if (!machine) return missingRecord('機械', '#/machines');
  const type = typeOf(machine.type);
  const repairs = state.repairs.filter((item) => item.assetKind !== 'engine' && item.machineId === machine.id);
  const certs = state.certificates.filter((item) => item.machineId === machine.id);
  const docs = state.documents.filter((item) => item.machineId === machine.id);
  const discipline = DISCIPLINES.find((item) => item.code === machine.discipline);
  const engine = engineOnMachine(state, machine);
  return `<article class="ef-spread is-full"><div class="ef-sheet">
      <p class="ef-crumb"><a href="#/machines">機械</a><a href="#/machines/type/${esc(machine.type)}">${esc(type?.name || machine.type)}</a><span>${esc(machine.code)}</span></p>
      <p><span class="ef-tag">${esc(machine.code)}</span></p>
      <ul class="ef-facts">
        <li class="ef-field">${esc(machine.company)}</li>
        <li class="ef-field">${esc(machine.discipline)} ${esc(discipline?.name || '')}</li>
        <li class="ef-field">${esc(machine.site)}</li>
        <li class="ef-field">${esc(machine.yearMade)} 出廠</li>
      </ul>
      <div class="title-band">
        <div>
          <h1 tabindex="-1">${esc(type?.name || machine.type)}</h1>
          <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
          <p class="ef-lede">${esc(machine.manufacturer)} ${esc(machine.model)}。序列號 ${esc(machine.serial)}。</p>
        </div>
        <div class="title-preview" aria-label="全身圖片">
          <p class="ef-actions">
            <label class="file-btn"><span class="ef-btn go">上傳預覽圖</span><input type="file" accept="image/*" multiple data-photo-for="${esc(machine.id)}" aria-label="上傳預覽圖"></label>
          </p>
          ${bodyPhotos(machine)}
          <p class="ef-lede">預覽圖可以一次上傳多張。不同時間的重要圖片放在圖片庫。</p>
        </div>
      </div>
      <div class="ledger-2${engine ? ' is-3' : ''}">
        <section>
          <h2 class="ef-group-head"><span>通用數據</span><span class="head-side"><a class="ef-btn small" href="#/machines/${esc(machine.code)}/edit">編輯</a><a class="ef-btn small" href="#/map?at=${esc(machine.code)}">在地圖查看</a><button class="ef-btn small danger" type="button" data-act="delete-machine" data-id="${esc(machine.id)}">刪除這台機械</button></span></h2>
          <ul class="ef-ledger">
            <li><span>廠商</span><span class="ef-field">${esc(machine.manufacturer)}</span></li>
            <li><span>型號</span><span class="ef-field">${esc(machine.model)}</span></li>
            <li><span>序列號</span><span class="ef-field">${esc(machine.serial)}</span></li>
            <li><span>出廠年份</span><span class="ef-field">${esc(machine.yearMade)}</span></li>
            <li><span>地點</span><span class="ef-field">${esc(machine.site)}</span></li>
            <li><span>狀態</span><span class="ef-state ${stateClass(machine.status)}">${esc(machine.status)}</span></li>
            <li><span>累計運行機鐘</span><span class="ef-field">${num(machine.hours)} 小時</span></li>
          </ul>
        </section>
        <section>
          <h2 class="ef-group-head"><span>這種機械的數據</span><span class="ef-field">${specRowsOf(machine).length} 項</span></h2>
          ${specItems(machine)}
        </section>
        ${engine}
      </div>
      <h2 class="ef-group-head"><span>維修紀錄</span><span class="head-side"><span class="ef-field">${repairs.length} 項</span><a class="ef-btn small go" href="#/repairs/new?machine=${esc(machine.code)}">填寫維修</a></span></h2>
      ${repairs.length ? `<ul class="ef-records">${repairs.map((item) => repairRecord(state, item, false)).join('')}</ul>` : '<p class="ef-empty">這台機械還沒有維修紀錄。</p>'}
      <h2 class="ef-group-head"><span>證書</span><span class="head-side"><span class="ef-field">${certs.length} 份</span><a class="ef-btn small" href="#/papers/cert/new?machine=${esc(machine.code)}">加證書</a></span></h2>
      ${certs.length ? `<ul class="ef-records">${certs.map((item) => certRecord(state, item)).join('')}</ul>` : '<p class="ef-empty">這台機械還沒有證書。</p>'}
      <h2 class="ef-group-head"><span>文件</span><span class="head-side"><span class="ef-field">${docs.length} 份</span><a class="ef-btn small" href="#/papers/doc/new?machine=${esc(machine.code)}">加文件</a></span></h2>
      ${docs.length ? `<ul class="ef-records">${docs.map((item) => docRecord(item)).join('')}</ul>` : '<p class="ef-empty">這台機械還沒有目錄、說明書或圖紙。</p>'}
      ${photoLibrary(machine)}
    </div></article>`;
}

function bodyPhotos(machine) {
  const photos = machine.photos || [];
  if (!photos.length) return '<p class="ef-empty">還沒有預覽圖。上傳後會顯示在這裡。</p>';
  const [main, ...rest] = photos;
  const side = rest.map((photo, index) => `<li><button type="button" data-act="preview-photo" data-id="${esc(machine.id)}" data-photo="${esc(photo.id)}" aria-label="放大預覽圖 ${index + 2}">
      <img src="${esc(photo.dataUrl)}" alt="${esc(photo.name)}">
    </button></li>`).join('');
  return `<div class="preview-stage">
    <button type="button" class="preview-main" data-act="preview-photo" data-id="${esc(machine.id)}" data-photo="${esc(main.id)}" aria-label="放大主預覽圖">
      <img src="${esc(main.dataUrl)}" alt="${esc(main.name)}">
    </button>
    ${side ? `<ul class="preview-side">${side}</ul>` : ''}
  </div>`;
}

function photoLibrary(machine) {
  const rows = libraryPhotos(machine);
  const tiles = rows.map((photo) => `<li>
      <button type="button" data-act="preview-library" data-id="${esc(machine.id)}" data-photo="${esc(photo.id)}" aria-label="放大 ${esc(photo.takenOn ? fmtDate(photo.takenOn) : '未記日期')} ${esc(photo.note)}">
        <img src="${esc(photo.dataUrl)}" alt="">
      </button>
      <p class="ef-field">${esc(photo.takenOn ? fmtDate(photo.takenOn) : '未記日期')}</p>
      <p>${esc(photo.note || photo.name)}</p>
    </li>`).join('');
  return `<h2 class="ef-group-head"><span>圖片庫</span><span class="ef-field">${rows.length} 張</span></h2>
    <form class="ef-form library-add" id="library-form">
      <div class="grid-2">
        ${field('拍攝日期', 'takenOn', today(), '', 'date')}
        ${field('說明', 'note', '', '這批圖片在記什麼')}
      </div>
      <p class="ef-actions">
        <label class="file-btn"><span class="ef-btn">加入圖片庫</span><input type="file" accept="image/*" multiple data-library-for="${esc(machine.id)}" aria-label="加入圖片庫"></label>
      </p>
    </form>
    ${rows.length ? `<ul class="gallery">${tiles}</ul>` : '<p class="ef-empty">還沒有圖片。不同時間影下的重要圖片會存在這裡。</p>'}`;
}

function libraryPhotos(machine) {
  return (machine.library || []).slice().sort((a, b) => String(b.takenOn).localeCompare(String(a.takenOn)) || String(b.id).localeCompare(String(a.id)));
}

function renderMachineForm(state, machine, extras) {
  const cache = extras.formCache || {};
  const value = (key, fallback = '') => (key in cache ? cache[key] : machine ? machine[key] ?? fallback : fallback);
  const preset = extras.routeQuery?.type || '';
  const typeCode = value('type', machine?.type || (liveTypes.some((item) => item.code === preset) ? preset : liveTypes[0]?.code || 'CC'));
  const type = typeOf(typeCode) || liveTypes[0];
  const code = value('code', machine?.code || (type ? nextMachineCode(type.code) : ''));
  const cancel = machine ? `#/machines/${esc(machine.code)}` : (type ? `#/machines/type/${esc(type.code)}` : '#/machines');
  return `${head(machine ? '編輯機械' : '登記機械', machine ? 'Edit' : 'New machine', machine ? machine.code : '編號會按種類接下去')}
    <section class="ef-panel"><form class="ef-form stack" id="machine-form">
      ${extras.notice || ''}
      <div class="grid-2">
        ${selectField('機械種類', 'type', liveTypes.map((item) => [item.code, `${item.code} ${item.name}`]), type?.code || '', 'data-type-select')}
        ${field('機械編號', 'code', code, '例如 CC03')}
        ${selectField('所屬公司', 'company', COMPANIES.map((item) => [item, item]), value('company', machine?.company || COMPANIES[0]))}
        ${selectField('工程類別', 'discipline', DISCIPLINES.map((item) => [item.code, `${item.code} ${item.name}`]), value('discipline', machine?.discipline || 'BP'))}
        ${selectField('狀態', 'status', STATUSES.map((item) => [item, item]), value('status', machine?.status || '在場'))}
        ${field('廠商', 'manufacturer', value('manufacturer', machine?.manufacturer || ''))}
        ${field('型號', 'model', value('model', machine?.model || ''))}
        ${field('序列號', 'serial', value('serial', machine?.serial || ''))}
        ${field('出廠年份', 'yearMade', value('yearMade', machine?.yearMade || ''), '', 'number')}
        ${field('累計運行機鐘', 'hours', value('hours', machine?.hours ?? ''), '小時', 'number')}
        ${field('所在地盤', 'site', value('site', machine?.site || ''), '', 'text', 'is-wide')}
        ${field('緯度', 'lat', value('lat', machine?.lat ?? ''), '', 'number')}
        ${field('經度', 'lng', value('lng', machine?.lng ?? ''), '', 'number')}
      </div>
      <h2>這種機械的數據</h2>
      <p class="ef-lede">先列出這種機械常用的欄。可以改名稱、加一項，或刪掉用不到的。保存後只屬於這台機械。</p>
      ${specEditor(extras.specRows || [])}
      <p class="ef-actions">
        <button class="ef-btn go" type="button" data-act="save-machine" data-id="${esc(machine?.id || '')}">保存</button>
        <a class="ef-btn" href="${cancel}">取消</a>
      </p>
    </form></section>`;
}

function renderTypeForm(state, type, extras) {
  const cache = extras.formCache || {};
  const pick = (key, fallback = '') => (key in cache ? cache[key] : fallback);
  const used = Boolean(type && state.machines.some((item) => item.type === type.code));
  const code = type ? type.code : pick('code');
  const mounts = 'mountsEngine' in cache ? cache.mountsEngine === '1' : Boolean(type?.mountsEngine);
  const preview = typePreviewOf(type, extras);
  const slotCode = String(code || '').trim() || '代號';
  return `${head(type ? '編輯種類' : '新增種類', type ? 'Edit type' : 'New type', type ? type.code : '代號會成為編號開頭')}
    <section class="ef-panel"><form class="ef-form stack" id="type-form">
      ${extras.notice || ''}
      <div class="grid-2">
        <label class="field"><span>代號</span><input name="code" value="${esc(code)}" ${used ? 'readonly' : ''} autocapitalize="characters"><small>${used ? '已有機械使用，代號不能改。' : '2 至 4 個英文字母，例如 SC。'}</small></label>
        ${field('名稱', 'name', pick('name', type?.name || ''))}
        ${field('簡稱', 'short', pick('short', type?.short || ''), '總覽錶盤上的短名')}
      </div>
      <label class="field check"><input type="checkbox" name="mountsEngine" value="1"${mounts ? ' checked' : ''}><span>可安裝引擎</span><small>只有勾選的種類，引擎才可以安裝上去。</small></label>
      <h2>預覽圖</h2>
      <p class="ef-lede">顯示在種類名單的左邊。沒有圖片時，那一格只寫代號。</p>
      ${typeMark(slotCode, preview)}
      <p class="ef-actions">
        <label class="file-btn"><span class="ef-btn">上傳預覽圖</span><input type="file" accept="image/*" data-type-preview aria-label="上傳預覽圖"></label>
        ${preview ? '<button class="ef-btn" type="button" data-act="clear-type-preview">移除預覽圖</button>' : ''}
      </p>
      <h2>新機械的預設欄</h2>
      <p class="ef-lede">登記這類機械時會先列出這些欄。改這裡不會改寫已經保存的機械。</p>
      ${fieldEditor(extras.specRows || [])}
      <p class="ef-actions">
        <button class="ef-btn go" type="button" data-act="save-type" data-code="${esc(type?.code || '')}">保存</button>
        ${type && !used ? `<button class="ef-btn danger" type="button" data-act="delete-type" data-code="${esc(type.code)}">刪除這個種類</button>` : ''}
        <a class="ef-btn" href="#/machines">取消</a>
      </p>
    </form></section>`;
}

function engineOnMachine(state, machine) {
  const mounted = (state.engines || []).find((item) => item.mountedMachineId === machine.id);
  const type = typeOf(machine.type);
  if (!mounted && !type?.mountsEngine) return '';
  if (!mounted) {
    return `<section>
      <h2 class="ef-group-head"><span>引擎</span></h2>
      <p class="ef-empty">這類機械可以安裝引擎，現時沒有掛上。<a href="#/engines">到引擎名冊</a></p>
    </section>`;
  }
  const repairing = engineIsRepairing(mounted, state.repairs);
  const label = engineStatusText(mounted, machine.code, repairing);
  return `<section>
    <h2 class="ef-group-head"><span>引擎</span><span class="ef-field">${esc(label)}</span></h2>
    <ul class="ef-records"><li><a class="ef-record" href="#/engines/${esc(mounted.code)}">
      <span class="ef-tag is-current">${esc(mounted.code)}</span>
      <span class="ef-field">${esc(mounted.yearMade)}</span>
      <span class="name">${esc(mounted.manufacturer)} ${esc(mounted.model)}</span>
      <span class="ef-field">${num(mounted.hours)} 機鐘</span>
    </a></li></ul>
  </section>`;
}

function renderEngineList(state, query, extras) {
  const rows = (state.engines || []).slice().sort((a, b) => a.code.localeCompare(b.code));
  const codeOf = (engine) => engineStatusCode(engine, engineIsRepairing(engine, state.repairs));
  const count = (code) => rows.filter((engine) => codeOf(engine) === code).length;
  const shown = query.status ? rows.filter((engine) => codeOf(engine) === query.status) : rows;
  let marked = false;
  const records = shown.map((engine) => {
    const first = !marked;
    marked = true;
    const host = state.machines.find((item) => item.id === engine.mountedMachineId);
    const label = engineStatusText(engine, host?.code, codeOf(engine) === 'repair');
    const cls = codeOf(engine) === 'repair' ? 'is-alert' : '';
    return `<li><a class="ef-record" href="#/engines/${esc(engine.code)}">
      <span class="ef-tag${first ? ' is-current' : ''}">${esc(engine.code)}</span>
      <span class="ef-field">${esc(engine.yearMade)}</span>
      <span class="name">${esc(engine.manufacturer)} ${esc(engine.model)} <span class="ef-state ${cls}">${esc(label)}</span></span>
      <span class="ef-field">${num(engine.hours)} 機鐘</span>
    </a></li>`;
  }).join('');
  return `${head('引擎', 'Engines', `共 ${rows.length} 台`)}
    <p class="ef-actions"><a class="ef-btn go" href="#/engines/new">登記引擎</a></p>
    ${searchBox('搜尋編號、廠商或型號', extras.q)}
    ${chipRow('掛載狀態', [
      ['', '全部', rows.length],
      ['stock', '庫存中', count('stock')],
      ['repair', '維修中', count('repair')],
      ['mounted', '已安裝', count('mounted')],
    ], 'status', query.status || '')}
    <div id="list-slot">${records ? `<ul class="ef-records">${records}</ul>` : ''}</div>
    <p class="ef-empty" id="list-empty" ${records ? 'hidden' : ''}>沒有符合條件的引擎。</p>`;
}

function renderEngine(state, engine) {
  if (!engine) return missingRecord('引擎', '#/engines');
  const host = state.machines.find((item) => item.id === engine.mountedMachineId);
  const repairing = engineIsRepairing(engine, state.repairs);
  const label = engineStatusText(engine, host?.code, repairing);
  const repairs = state.repairs.filter((item) => item.assetKind === 'engine' && item.engineId === engine.id);
  const specs = Array.isArray(engine.specList) ? engine.specList : [];
  const trail = (state.engineTrail || [])
    .filter((item) => item.engineId === engine.id)
    .slice()
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const trailRows = trail.map((item) => {
    const person = personById(item.actorId);
    const kind = item.kind === 'install' ? '安裝' : item.kind === 'remove' ? '拆卸' : '機鐘';
    const detail = item.kind === 'hours'
      ? `增加 ${num(item.delta)} 小時`
      : `${kind}於 ${item.machineCode || '—'}`;
    return `<li><span>${esc(fmtStamp(item.at))} ${esc(kind)}</span><span>${esc(detail)} · ${esc(person?.name || '—')} · 引擎 ${num(item.engineHours)} / 機械 ${num(item.machineHours)}</span></li>`;
  }).join('');
  const installed = host
    ? trail.find((item) => item.kind === 'install' && item.machineId === host.id)
    : null;
  const installedOn = installed ? String(installed.at).slice(0, 10) : '';
  const serviceDates = repairs
    .flatMap((item) => item.sessions.filter((session) => session.type === '保養').map((session) => session.date))
    .filter(Boolean)
    .sort();
  const lastService = serviceDates.at(-1) || '';
  const candidates = mountCandidates(state, engine);
  let mount = '';
  if (engine.mountedMachineId) {
    mount = `<p class="ef-actions"><button class="ef-btn" type="button" data-act="unmount-engine" data-id="${esc(engine.id)}">拆卸引擎</button></p>`;
  } else if (repairing) {
    mount = '<p class="ef-lede">維修中的引擎不能安裝。完成維修後可以再掛上。</p>';
  } else if (!candidates.length) {
    mount = '<p class="ef-empty">現時沒有可以安裝的機械。種類要勾選可安裝引擎，而且那台機械還沒有別的引擎。</p>';
  } else {
    const options = candidates.map((item) => `<option value="${esc(item.id)}">${esc(item.code)} ${esc(typeOf(item.type)?.name || '')}</option>`).join('');
    mount = `<form class="ef-form stack" id="mount-form">
      <label class="field"><span>安裝到</span><select name="hostId">${options}</select></label>
      <p class="ef-actions"><button class="ef-btn go" type="button" data-act="mount-engine" data-id="${esc(engine.id)}">安裝</button></p>
    </form>`;
  }
  return `<article class="ef-spread"><div class="ef-sheet">
      <p class="ef-crumb"><a href="#/engines">引擎</a><span>${esc(engine.code)}</span></p>
      <p><span class="ef-tag">${esc(engine.code)}</span></p>
      <h1 tabindex="-1">${esc(engine.manufacturer)} ${esc(engine.model)}</h1>
      <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
      <p class="ef-lede">序列號 ${esc(engine.serial)}。</p>
      <div class="ledger-2 is-3">
        <section>
          <h2 class="ef-group-head"><span>基本資訊</span></h2>
          <ul class="ef-ledger">
            ${infoRow('編號', esc(engine.code))}
            ${infoRow('機械類型', '引擎')}
            ${infoRow('型號', esc(engine.model))}
            ${infoRow('製造商', esc(engine.manufacturer))}
            ${infoRow('馬力／排量', esc(powerLine(specs)))}
            ${infoRow('燃料類型', esc(engine.fuel || '—'))}
            ${infoRow('排放標準', esc(engine.emission || '—'))}
          </ul>
        </section>
        <section>
          <h2 class="ef-group-head"><span>安裝機械</span></h2>
          <ul class="ef-ledger">
            ${infoRow('目前安裝', host ? `<a href="#/machines/${esc(host.code)}">${esc(host.code)}</a>` : '—')}
            ${infoRow('機械類型', esc(host ? typeOf(host.type)?.name || '—' : '—'))}
            ${infoRow('安裝日期', esc(installedOn ? fmtDate(installedOn) : '—'))}
            ${infoRow('狀態', `<span class="ef-state ${repairing ? 'is-alert' : ''}">${esc(label)}</span>`)}
          </ul>
          ${mount}
        </section>
        <section>
          <h2 class="ef-group-head"><span>運行數據</span></h2>
          <ul class="ef-ledger">
            ${infoRow('總運行時數', `${num(engine.hours)} 小時`)}
            ${infoRow('上次保養', esc(lastService ? fmtDate(lastService) : '—'))}
            ${infoRow('下次保養', '—')}
            ${infoRow('機油更換週期', esc(engine.oilHours ? `每 ${num(engine.oilHours)} 小時` : '—'))}
          </ul>
        </section>
      </div>
      <h2 class="ef-group-head"><span>安裝與拆卸</span><span class="ef-field">${trail.length} 筆</span></h2>
      ${trailRows ? `<ul class="ef-ledger">${trailRows}</ul>` : '<p class="ef-empty">還沒有安裝或拆卸紀錄。</p>'}
      <h2 class="ef-group-head"><span>維修紀錄</span><span class="ef-field">${repairs.length} 項</span></h2>
      ${repairs.length ? `<ul class="ef-records">${repairs.map((item) => repairRecord(state, item, false)).join('')}</ul>` : '<p class="ef-empty">這台引擎還沒有維修紀錄。</p>'}
    </div>
    <aside class="ef-margin" aria-label="操作">
      <p class="ef-actions">
        <a class="ef-btn go" href="#/repairs/new?engine=${esc(engine.code)}">填寫維修</a>
        <a class="ef-btn" href="#/engines/${esc(engine.code)}/edit">編輯</a>
        <button class="ef-btn danger" type="button" data-act="delete-engine" data-id="${esc(engine.id)}">刪除這台引擎</button>
      </p>
    </aside></article>`;
}

function renderEngineForm(state, engine, extras) {
  const cache = extras.formCache || {};
  const value = (key, fallback = '') => (key in cache ? cache[key] : engine ? engine[key] ?? fallback : fallback);
  const code = value('code', engine?.code || nextEngineCode());
  return `${head(engine ? '編輯引擎' : '登記引擎', engine ? 'Edit' : 'New engine', engine ? engine.code : '編號由 EN 接下去')}
    <section class="ef-panel"><form class="ef-form stack" id="engine-form">
      ${extras.notice || ''}
      <div class="grid-2">
        ${field('引擎編號', 'code', code, '例如 EN04')}
        ${field('廠商', 'manufacturer', value('manufacturer', engine?.manufacturer || ''))}
        ${field('型號', 'model', value('model', engine?.model || ''))}
        ${field('序列號', 'serial', value('serial', engine?.serial || ''))}
        ${field('出廠年份', 'yearMade', value('yearMade', engine?.yearMade || ''), '', 'number')}
        ${field('累計運行機鐘', 'hours', value('hours', engine?.hours ?? ''), '小時', 'number')}
        ${field('燃料類型', 'fuel', value('fuel', engine?.fuel || ''), '例如 柴油')}
        ${field('排放標準', 'emission', value('emission', engine?.emission || ''), '例如 Tier 3')}
        ${field('機油更換週期', 'oilHours', value('oilHours', engine?.oilHours ?? ''), '小時，可留空', 'number')}
      </div>
      <h2>規格</h2>
      <p class="ef-lede">功率、排量或其他需要跟著這台引擎走的數據，可以在這裡增刪。</p>
      ${specEditor(extras.specRows || [])}
      <p class="ef-actions">
        <button class="ef-btn go" type="button" data-act="save-engine" data-id="${esc(engine?.id || '')}">保存</button>
        <a class="ef-btn" href="${engine ? `#/engines/${esc(engine.code)}` : '#/engines'}">取消</a>
      </p>
    </form></section>`;
}

function infoRow(label, value) {
  return `<li><span>${esc(label)}</span><span class="ef-field">${value}</span></li>`;
}

function powerLine(specs) {
  const text = (label) => {
    const row = specs.find((item) => item.label === label);
    const shown = String(row?.value || '').trim();
    if (!shown) return '';
    return row.unit ? `${shown} ${row.unit}` : shown;
  };
  return [text('功率'), text('排量')].filter(Boolean).join(' / ') || '—';
}

function mountCandidates(state, engine) {
  const taken = new Set((state.engines || []).filter((item) => item.id !== engine.id && item.mountedMachineId).map((item) => item.mountedMachineId));
  return state.machines
    .filter((machine) => typeOf(machine.type)?.mountsEngine && !taken.has(machine.id))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function findEngine(state, code) {
  if (!code) return null;
  return (state.engines || []).find((item) => item.code === code) || null;
}

function machinesWithMeter(state) {
  return state.machines
    .filter((item) => Number.isFinite(Number(item.hours)))
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code));
}

function meterFace(machine) {
  if (machine.meter == null || machine.meter === '') return Number(machine.hours) || 0;
  return Number(machine.meter) || 0;
}

export function renderHourForm(state, extras) {
  const draft = extras.meterDraft;
  const machines = machinesWithMeter(state);
  if (!draft) return missingRecord('機鐘', '#/repairs');
  if (!machines.length) {
    return `${head('紀錄機鐘', 'Hours', '沒有可記的設備')}
      <p class="ef-empty">還沒有帶運行機鐘的設備。</p>
      <p class="ef-actions"><a class="ef-btn" href="#/repairs">返回</a></p>`;
  }
  const rows = (draft.rows.length ? draft.rows : [{ machineId: machines[0].id, reading: '' }]).map((row, index) => {
    const machine = machines.find((item) => item.id === row.machineId) || machines[0];
    const previous = meterFace(machine);
    const cumulative = Number(machine.hours) || 0;
    const reading = String(row.reading ?? '');
    const punch = reading === '' ? null : meterPunch(previous, cumulative, reading);
    const options = machines.map((item) => `<option value="${esc(item.id)}"${item.id === machine.id ? ' selected' : ''}>${esc(item.code)}</option>`).join('');
    const flag = punch?.replaced
      ? '<span class="ef-state is-alert">換新錶</span><small>讀數低於上次，已視為換新錶。</small>'
      : '';
    return `<tr data-meter-row data-previous="${previous}" data-cumulative="${cumulative}">
      <td><select data-meter-machine aria-label="設備編號">${options}</select></td>
      <td>${esc(machine.model || machine.manufacturer || '—')}</td>
      <td class="ef-field">${num(previous)}</td>
      <td><label class="meter-now"><input type="number" min="0" step="any" data-meter-reading value="${esc(reading)}" aria-label="本次讀數">${flag}</label></td>
      <td class="ef-field" data-meter-run>${punch ? `${num(punch.run)} 小時` : '—'}</td>
      <td class="ef-field" data-meter-sum>${punch ? num(punch.cumulative) : '—'}</td>
      <td><button class="ef-btn small" type="button" data-act="remove-meter" data-index="${index}">移除</button></td>
    </tr>`;
  }).join('');
  const filled = (draft.rows.length ? draft.rows : [{ reading: '' }]).filter((row) => String(row.reading ?? '') !== '').length;
  const total = draft.rows.length || 1;
  return `${head('紀錄機鐘', 'Hours', '打卡')}
    <section class="ef-panel"><form class="ef-form stack" id="meter-form">
      ${extras.notice || ''}
      <label class="field"><span>日期</span><input name="date" type="date" value="${esc(draft.date || today())}" required></label>
      <p class="ef-lede">可每日、每週或按需要打卡。月份機鐘由各次紀錄加總。只有有運行機鐘的設備可以記。</p>
      <div class="meter-scroll"><table class="meter-table">
        <thead><tr><th>設備編號</th><th>設備名稱</th><th>上次讀數</th><th>本次讀數</th><th>運行時數</th><th>累積讀數</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="ef-actions"><button class="ef-btn" type="button" data-act="add-meter">新增設備</button></p>
      <p class="meter-foot">
        <span class="ef-field">已填寫 ${filled} / ${total} 部機械</span>
        <span class="ef-actions">
          <a class="ef-btn" href="#/repairs">取消</a>
          <button class="ef-btn go" type="button" data-act="save-meter">確認提交</button>
        </span>
      </p>
    </form></section>`;
}

function renderRepairList(state, query, extras) {
  const mineId = extras.user?.id;
  const visible = state.repairs.filter((item) => item.status !== 'draft' || item.ownerId === mineId);
  let rows = visible.slice().sort((a, b) => latestDate(b).localeCompare(latestDate(a)));
  if (query.status) rows = rows.filter((item) => item.status === query.status);
  if (query.mine === '1') rows = rows.filter((item) => item.ownerId === mineId || item.sessions.some((session) => staffIdsOf(session).includes(mineId)));
  if (query.from || query.to) rows = rows.filter((item) => sessionInRange(item, query.from, query.to));
  if (query.rtype) rows = rows.filter((item) => item.sessions.some((session) => session.type === query.rtype));
  const groups = new Map();
  for (const repair of rows) {
    const key = latestDate(repair).slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(repair);
  }
  let markedRepair = false;
  const body = [...groups.entries()].map(([key, items]) => {
    const records = items.map((item) => {
      const first = !markedRepair;
      markedRepair = true;
      return repairRecord(state, item, first);
    }).join('');
    return `<section class="group"><h3 class="ef-group-head"><span>${esc(key.replace('-', '.'))}</span><span class="ef-field">${items.length} 項</span></h3>
      <ul class="ef-records">${records}</ul></section>`;
  }).join('');
  const mine = query.mine === '1';
  const who = extras.user?.name || '';
  const typeOptions = ['', ...REPAIR_TYPES].map((item) => `<option value="${esc(item)}"${(query.rtype || '') === item ? ' selected' : ''}>${item ? esc(item) : '全部'}</option>`).join('');
  const statuses = [['', '全部'], ['open', '進行中'], ['done', '已完成'], ['draft', '草稿']];
  const statusOptions = statuses.map(([value, label]) => `<option value="${value}"${(query.status || '') === value ? ' selected' : ''}>${label}</option>`).join('');
  return `${head('維修', 'Repairs', `共 ${rows.length} 項`)}
    <div class="scope-switch" role="group" aria-label="維修範圍">
      <button class="ef-btn${mine ? '' : ' go'}" type="button" aria-pressed="${mine ? 'false' : 'true'}" data-act="repair-scope" data-value="">全部維修紀錄</button>
      <button class="ef-btn${mine ? ' go' : ''}" type="button" aria-pressed="${mine ? 'true' : 'false'}" data-act="repair-scope" data-value="mine">個人維修紀錄${who ? ` · ${esc(who)}` : ''}</button>
    </div>
    <div class="repair-filters">
      <label class="field"><span>由</span><input type="date" data-repair-filter="from" value="${esc(query.from || '')}"${query.from ? ' class="is-on"' : ''}></label>
      <label class="field"><span>至</span><input type="date" data-repair-filter="to" value="${esc(query.to || '')}"${query.to ? ' class="is-on"' : ''}></label>
      <label class="field"><span>維修類型</span><select data-repair-filter="rtype"${query.rtype ? ' class="is-on"' : ''}>${typeOptions}</select></label>
      <label class="field"><span>狀態</span><select data-repair-filter="status"${query.status ? ' class="is-on"' : ''}>${statusOptions}</select></label>
    </div>
    ${searchBox('搜尋編號、機械、引擎或地盤', extras.q)}
    <div class="lede-row">
      <p class="ef-lede">正班是每天 08:00 至 18:00。未完成的紀錄可以逐次續做，每次內容分開計算。</p>
      <span class="ef-actions">
        <a class="ef-btn go" href="#/repairs/new">填寫維修</a>
        <a class="ef-btn" href="#/hours">紀錄機鐘</a>
      </span>
    </div>
    <div id="list-slot">${body}</div>
    <p class="ef-empty" id="list-empty" ${body ? 'hidden' : ''}>沒有符合條件的維修紀錄。</p>`;
}

function renderRepair(state, repair) {
  if (!repair) return missingRecord('維修', '#/repairs');
  const subject = repairSubject(state, repair);
  const totals = repairTotals(repair);
  const sessions = repair.sessions.map((session, index) => {
    const part = splitShift(session.start, session.end);
    const names = staffIdsOf(session).map((id) => personById(id)?.name).filter(Boolean);
    const parts = session.parts.length
      ? session.parts.map((item) => `${esc(item.name)} × ${esc(item.qty || '1')}${item.partNo ? `（${esc(item.partNo)}）` : ''}`).join('、')
      : '沒有更換零件';
    return `<section class="session">
      <p class="ef-eyebrow slash">Session ${String(index + 1).padStart(2, '0')}</p>
      <h2>第 ${index + 1} 次</h2>
      <ul class="ef-facts">
        <li class="ef-field">${esc(fmtDate(session.date))}</li>
        <li class="ef-field">${esc(session.start)}–${esc(session.end)}</li>
        <li class="ef-field">${esc(names.join('、') || '—')}</li>
        <li class="ef-field">${esc(session.location)}</li>
      </ul>
      <p><span class="ef-state">${esc(session.type)}</span></p>
      <ul class="ef-ledger">
        <li><span>正班</span><span class="ef-field">${esc(fmtMinutes(part?.regularMin || 0))}</span></li>
        <li><span>加班</span><span class="ef-field${part?.otMin ? ' warn' : ''}">${esc(fmtMinutes(part?.otMin || 0))}</span></li>
        <li><span>故障原因</span><span>${esc(session.fault || '沒有填寫')}</span></li>
        <li><span>維修過程</span><span>${esc(session.process)}</span></li>
        <li><span>更換零件</span><span>${parts}</span></li>
      </ul>
      ${repair.status === 'open' ? `<p class="ef-actions"><a class="ef-btn" href="#/repairs/${esc(repair.number)}/edit/${encodeURIComponent(session.id)}">修改這次</a></p>` : ''}
    </section>`;
  }).join('');
  const openActions = repair.status === 'open'
    ? `<a class="ef-btn go" href="#/repairs/${esc(repair.number)}/session">再加一次</a>
       <button class="ef-btn" type="button" data-act="complete-repair" data-id="${esc(repair.id)}">標為完成</button>`
    : '';
  return `<article class="ef-spread"><div class="ef-sheet">
      <p class="ef-crumb"><a href="#/repairs">維修</a><span>${esc(repair.number)}</span></p>
      <p><span class="ef-tag">${esc(repair.number)}</span></p>
      <ul class="ef-facts">
        <li class="ef-field">${esc(fmtDate(repair.openedOn))} 開立</li>
        <li class="ef-field">${repair.sessions.length} 次</li>
        <li class="ef-field">累計 ${esc(fmtMinutes(totals.total))}</li>
      </ul>
      <h1 tabindex="-1">${esc(subject.code)} ${esc(subject.name)}</h1>
      <div class="ef-tri" aria-hidden="true"><i></i><i></i><i></i></div>
      <p><span class="ef-state ${repair.status === 'open' ? 'is-alert' : ''}">${repair.status === 'open' ? '進行中' : '已完成'}</span></p>
      <ul class="ef-ledger">
        <li><span>正班合計</span><span class="ef-field">${esc(fmtMinutes(totals.regular))}</span></li>
        <li><span>加班合計</span><span class="ef-field${totals.ot ? ' warn' : ''}">${esc(fmtMinutes(totals.ot))}</span></li>
      </ul>
      ${sessions || '<p class="ef-empty">這項維修還沒有任何一次紀錄。</p>'}
    </div>
    <aside class="ef-margin">
      <p class="ef-actions">
        ${openActions}
        <a class="ef-btn" href="${subject.href}">開啟檔案</a>
        <button class="ef-btn danger" type="button" data-act="delete-repair" data-id="${esc(repair.id)}">刪除這項維修</button>
      </p>
    </aside></article>`;
}

function renderRepairForm(state, extras) {
  const draft = extras.draft;
  if (!draft) return missingRecord('維修', '#/repairs');
  const repair = state.repairs.find((item) => item.id === draft.repairId);
  const continuing = Boolean(repair && repair.status !== 'draft');
  const openRepairs = state.repairs.filter((item) => item.status === 'open');
  const shift = splitShift(draft.start, draft.end);
  const step = draft.step;
  let body = '';
  if (step === 1) {
    const kinds = [
      ['machine', '機械設備', '選擇此類型'],
      ['engine', '引擎', '選擇此類型'],
      ['drill', '鑽具設備', '稍後開放'],
      ['tool', '地盤工具', '稍後開放'],
      ['electrical', '電器設備', '稍後開放'],
    ];
    const cards = kinds.map(([kind, name, action]) => {
      const on = draft.equipType === kind;
      return `<button type="button" class="kind-card${on ? ' is-current' : ''}" aria-pressed="${on}" data-act="repair-kind" data-kind="${kind}"><span class="name">${name}</span><span class="ef-field">${action}</span></button>`;
    }).join('');
    body = `<p class="ef-lede">請選擇這次維修的設備類型。</p><div class="kind-grid">${cards}</div>`;
  } else if (step === 2) {
    const continues = openRepairs.map((item) => {
      const subject = repairSubject(state, item);
      const on = continuing && draft.repairId === item.id;
      return `<button type="button" class="ef-chip${on ? ' is-active' : ''}" aria-pressed="${on}" data-act="continue-repair" data-id="${esc(item.id)}">接續 ${esc(item.number)} ${esc(subject.code)}</button>`;
    }).join('');
    const pickingEngine = draft.assetKind === 'engine';
    const options = pickingEngine
      ? (state.engines || []).map((item) => `<option value="${esc(item.id)}"${item.id === draft.engineId && !draft.repairId ? ' selected' : ''}>${esc(item.code)} ${esc(item.manufacturer)} ${esc(item.model)}</option>`).join('')
      : state.machines.map((item) => `<option value="${esc(item.id)}"${item.id === draft.machineId && !draft.repairId ? ' selected' : ''}>${esc(item.code)} ${esc(typeOf(item.type)?.name || '')} ${esc(item.site)}</option>`).join('');
    const selectName = pickingEngine ? 'engineId' : 'machineId';
    const selectLabel = pickingEngine ? '新開一項，選擇引擎' : '新開一項，選擇機械';
    body = `${continues ? `<div class="filters" role="group" aria-label="未完成維修">${continues}</div>` : '<p class="ef-empty">現時沒有未完成的維修，下面可新開一項。</p>'}
      <label class="field"><span>${selectLabel}</span><select name="${selectName}" ${continuing ? 'disabled' : ''}>${options}</select>
      <small>選了上面的接續之後，這次會加在該項紀錄裡。</small></label>
      ${continuing ? '<p class="ef-actions"><button class="ef-btn small" type="button" data-act="new-repair">改為新開一項</button></p>' : ''}`;
  } else {
    const types = REPAIR_TYPES.map((item) => `<option${item === draft.type ? ' selected' : ''}>${esc(item)}</option>`).join('');
    const parts = (draft.parts.length ? draft.parts : [{ name: '', qty: '1', partNo: '' }]).map((part, index) => partRow(part, index)).join('');
    body = `${lockedAsset(state, draft, repair)}
      <div class="grid-2">
        ${field('日期', 'date', draft.date, '', 'date')}
        ${field('地點', 'location', draft.location)}
      </div>
      ${staffPicker(state, draft)}
      <div class="grid-2">
        ${field('開始時間', 'start', draft.start, '', 'time')}
        ${field('結束時間', 'end', draft.end, '', 'time')}
      </div>
      <p class="ef-lede">正班為 08:00 至 18:00，共 10 小時。這段以外的時間計入加班。</p>
      <div class="shift-readout" id="shift-readout">${shiftBox(shift)}</div>
      <label class="field"><span>維修類型</span><select name="type">${types}</select></label>
      <label class="field"><span>故障原因</span><textarea name="fault" rows="3">${esc(draft.fault)}</textarea><small>保養和檢查可以留空。突發維修要填原因。</small></label>
      <label class="field"><span>維修過程</span><textarea name="process" rows="4">${esc(draft.process)}</textarea></label>
      <div class="stack" id="parts">${parts}<p class="ef-actions"><button class="ef-btn small" type="button" data-act="add-part">加一件零件</button></p></div>`;
  }
  const next = step === 2
    ? '<button class="ef-btn go" type="button" data-act="repair-next">下一步</button>'
    : step > 2
      ? `<button class="ef-btn go" type="button" data-act="repair-submit" data-finish="1">提交並完成</button>
       <button class="ef-btn" type="button" data-act="repair-submit" data-finish="0">提交，尚未完成</button>`
      : '';
  const keep = step > 1 && (!repair || repair.status === 'draft')
    ? '<button class="ef-btn" type="button" data-act="save-draft">存成草稿</button>'
    : '';
  const drop = repair?.status === 'draft'
    ? `<button class="ef-btn danger" type="button" data-act="delete-repair" data-id="${esc(repair.id)}">刪除草稿</button>`
    : '';
  return `${head(repair?.status === 'draft' ? '草稿' : repair ? '續做維修' : '填寫維修', 'Repair', repair ? repair.number : '新紀錄')}
    <section class="ef-panel"><form class="ef-form stack" id="repair-form">
      ${stepBar(step)}
      ${extras.notice || ''}
      ${body}
      <p class="ef-actions">${next}${keep}${drop}<a class="ef-btn" href="${repair && repair.status !== 'draft' ? `#/repairs/${esc(repair.number)}` : '#/repairs'}">取消</a></p>
    </form></section>`;
}

function renderRepairEdit(state, extras) {
  const draft = extras.draft;
  const repair = draft?.repairId ? state.repairs.find((item) => item.id === draft.repairId) : null;
  const session = repair?.sessions.find((item) => item.id === draft?.sessionId);
  if (!repair || repair.status !== 'open' || !session) return missingRecord('維修', repair ? `#/repairs/${repair.number}` : '#/repairs');
  const index = repair.sessions.findIndex((item) => item.id === session.id);
  const shift = splitShift(draft.start, draft.end);
  const types = REPAIR_TYPES.map((item) => `<option${item === draft.type ? ' selected' : ''}>${esc(item)}</option>`).join('');
  const parts = (draft.parts.length ? draft.parts : [{ name: '', qty: '1', partNo: '' }]).map((part, row) => partRow(part, row)).join('');
  return `${head('修改維修', 'Edit', `${repair.number} · 第 ${index + 1} 次`)}
    <section class="ef-panel"><form class="ef-form stack" id="repair-form">
      ${extras.notice || ''}
      ${lockedAsset(state, draft, repair)}
      <div class="grid-2">
        ${field('日期', 'date', draft.date, '', 'date')}
        ${field('地點', 'location', draft.location)}
      </div>
      ${staffPicker(state, draft)}
      <div class="grid-2">
        ${field('開始時間', 'start', draft.start, '', 'time')}
        ${field('結束時間', 'end', draft.end, '', 'time')}
      </div>
      <p class="ef-lede">正班為 08:00 至 18:00，共 10 小時。這段以外的時間計入加班。完成之後不能再改。</p>
      <div class="shift-readout" id="shift-readout">${shiftBox(shift)}</div>
      <label class="field"><span>維修類型</span><select name="type">${types}</select></label>
      <label class="field"><span>故障原因</span><textarea name="fault" rows="3">${esc(draft.fault)}</textarea><small>保養和檢查可以留空。突發維修要填原因。</small></label>
      <label class="field"><span>維修過程</span><textarea name="process" rows="4">${esc(draft.process)}</textarea></label>
      <div class="stack" id="parts">${parts}<p class="ef-actions"><button class="ef-btn small" type="button" data-act="add-part">加一件零件</button></p></div>
      <p class="ef-actions">
        <button class="ef-btn go" type="button" data-act="save-session">保存</button>
        <a class="ef-btn" href="#/repairs/${esc(repair.number)}">取消</a>
      </p>
    </form></section>`;
}

function staffPicker(state, draft) {
  const picked = draft.staffIds?.length ? draft.staffIds : (draft.staffId ? [draft.staffId] : []);
  const names = picked.map((id) => state.people.find((person) => person.id === id)?.name).filter(Boolean);
  const hidden = picked.map((id) => `<input type="hidden" name="staffId" value="${esc(id)}">`).join('');
  const label = names.length ? names.join('、') : '選擇人員';
  return `<label class="field">
    <span>負責人員</span>
    <button class="staff-box${names.length ? '' : ' is-empty'}" type="button" data-act="pick-staff">${esc(label)}</button>
    ${hidden}
  </label>`;
}

function renderMapPage(state, selected) {
  const machine = findCode(state, selected);
  return `${head('地圖', 'Map', `香港 · ${state.machines.length} 台`)}
    <div class="map-layout">
      <div class="map-frame"><div id="hk-map" role="region" aria-label="香港機械位置"></div></div>
      <section class="ef-panel" id="map-card">${renderMapCard(machine)}</section>
    </div>
    <h2 class="ef-group-head"><span>名冊</span><span class="ef-field">${state.machines.length} 台</span></h2>
    <ul class="ef-records" id="map-list">${state.machines.map((item) => `<li><button type="button" class="ef-record" data-act="map-focus" data-code="${esc(item.code)}">
      <span class="ef-tag${item.code === selected ? ' is-current' : ''}">${esc(item.code)}</span>
      <span class="ef-field">${esc(item.site)}</span>
      <span class="name">${esc(typeOf(item.type)?.name || '')}</span>
      <span class="ef-field">${esc(item.status)}</span>
    </button></li>`).join('')}</ul>`;
}

export function renderMapCard(machine) {
  if (!machine) return '<p class="ef-empty">在地圖上點一台機械，這裡會顯示編號、地盤和機鐘。</p>';
  const type = typeOf(machine.type);
  return `<p class="ef-eyebrow slash">Machine</p>
    <h2>${esc(machine.code)}</h2>
    <p>${esc(type?.name || '')}</p>
    <ul class="ef-ledger">
      <li><span>公司</span><span class="ef-field">${esc(machine.company)}</span></li>
      <li><span>工程</span><span class="ef-field">${esc(machine.discipline)}</span></li>
      <li><span>地盤</span><span class="ef-field">${esc(machine.site)}</span></li>
      <li><span>機鐘</span><span class="ef-field">${num(machine.hours)} 小時</span></li>
      <li><span>狀態</span><span class="ef-field">${esc(machine.status)}</span></li>
    </ul>
    <p class="ef-actions"><a class="ef-btn go" href="#/machines/${esc(machine.code)}">開啟檔案</a></p>`;
}

function renderPapers(state, route, extras) {
  const docs = route.parts[1] === 'docs';
  const mode = `<div class="filters" role="group" aria-label="證書或文件">
      <a class="ef-chip${docs ? '' : ' is-active'}" href="#/papers"${docs ? '' : ' aria-current="page"'}>證書 <span class="n">${state.certificates.length}</span></a>
      <a class="ef-chip${docs ? ' is-active' : ''}" href="#/papers/docs"${docs ? ' aria-current="page"' : ''}>文件 <span class="n">${state.documents.length}</span></a>
    </div>`;
  if (docs) {
    const groups = DOC_KINDS.map((kind) => {
      const items = state.documents.filter((item) => item.kind === kind.code);
      if (!items.length) return '';
      return `<section class="group"><h3 class="ef-group-head"><span>${esc(kind.name)}</span><span class="ef-field">${items.length} 份</span></h3>
        <ul class="ef-records">${items.map((item) => docRecord(item)).join('')}</ul></section>`;
    }).join('');
    return `${head('文件', 'Documents', `共 ${state.documents.length} 份`)}
      <p class="ef-actions"><a class="ef-btn go" href="#/papers/doc/new">加入文件</a></p>
      ${mode}
      ${searchBox('搜尋文件或機械編號', extras.q)}
      <p class="ef-lede">目錄、說明書、油路圖和電路圖可以在這裡預覽。</p>
      <div id="list-slot">${groups}</div>
      <p class="ef-empty" id="list-empty" ${groups ? 'hidden' : ''}>還沒有文件。</p>`;
  }
  const due = dueCertificates(state);
  const statutory = state.certificates.filter((item) => certForm(item.form)?.group === 'statutory');
  const env = state.certificates.filter((item) => certForm(item.form)?.group === 'env');
  const block = (title, items) => items.length ? `<section class="group"><h3 class="ef-group-head"><span>${title}</span><span class="ef-field">${items.length} 份</span></h3><ul class="ef-records">${items.map((item) => certRecord(state, item)).join('')}</ul></section>` : '';
  return `${head('證書', 'Certificates', `共 ${state.certificates.length} 份`)}
    <p class="ef-actions"><a class="ef-btn go" href="#/papers/cert/new">加入證書</a></p>
    ${mode}
    ${due.length ? `<p class="ef-notice" data-flag="續期">有 ${due.length} 份已到期或將到期，後勤要安排續期。</p>` : ''}
    ${searchBox('搜尋證書編號或機械', extras.q)}
    <div id="list-slot">${block('法定證書', statutory)}${block('環保證書', env)}</div>
    <p class="ef-empty" id="list-empty" hidden>沒有符合的證書。</p>`;
}

function renderCertForm(state, cert, extras) {
  const cache = extras.formCache || {};
  const pick = (key, fallback = '') => (key in cache ? cache[key] : cert ? cert[key] ?? fallback : fallback);
  const preset = extras.routeQuery?.machine || '';
  const presetMachine = findCode(state, preset);
  const machineId = pick('machineId', cert?.machineId || presetMachine?.id || state.machines[0]?.id || '');
  const form = pick('form', cert?.form || 'F5');
  const meta = certForm(form);
  const options = state.machines.map((item) => `<option value="${esc(item.id)}"${item.id === machineId ? ' selected' : ''}>${esc(item.code)} ${esc(typeOf(item.type)?.name || '')}</option>`).join('');
  const forms = CERT_FORMS.map((item) => `<option value="${esc(item.code)}"${item.code === form ? ' selected' : ''}>${esc(item.name)} ${esc(item.full)}</option>`).join('');
  return `${head(cert ? '編輯證書' : '加入證書', 'Certificate', meta?.full || '')}
    <section class="ef-panel"><form class="ef-form stack" id="cert-form">
      ${extras.notice || ''}
      <label class="field"><span>機械</span><select name="machineId">${options}</select></label>
      <label class="field"><span>證書</span><select name="form" data-cert-form>${forms}</select></label>
      ${field('證書編號', 'number', pick('number', cert?.number || ''))}
      ${field('簽發日期', 'issuedOn', pick('issuedOn', cert?.issuedOn || today()), '', 'date')}
      ${field('到期日', 'expiresOn', pick('expiresOn', cert?.expiresOn || ''), '沒有到期日可留空', 'date')}
      ${field('提前提醒日數', 'leadDays', pick('leadDays', cert?.leadDays ?? meta?.lead ?? 30), '到期前這幾日，首頁的提醒會通知後勤', 'number')}
      <label class="field"><span>掃描檔</span><input name="file" type="file" accept="image/*,.pdf,application/pdf"><small>${cert?.href ? '已有檔案。再選檔案會換成新的。' : '可以稍後再補。'}</small></label>
      ${cert?.href ? `<p class="ef-actions"><button class="ef-btn small" type="button" data-act="preview-doc" data-id="${esc(cert.id)}" data-source="cert">預覽現有檔案</button></p>` : ''}
      <p class="ef-actions">
        <button class="ef-btn go" type="button" data-act="save-cert" data-id="${esc(cert?.id || '')}">保存</button>
        ${cert ? `<button class="ef-btn danger" type="button" data-act="delete-cert" data-id="${esc(cert.id)}">刪除這份證書</button>` : ''}
        <a class="ef-btn" href="#/papers">取消</a>
      </p>
    </form></section>`;
}

function renderDocForm(state, doc, extras) {
  const cache = extras.formCache || {};
  const pick = (key, fallback = '') => (key in cache ? cache[key] : doc ? doc[key] ?? fallback : fallback);
  const preset = findCode(state, extras.routeQuery?.machine || '');
  const machineId = pick('machineId', doc?.machineId || preset?.id || '');
  const options = [`<option value="">不指定機械</option>`].concat(state.machines.map((item) => `<option value="${esc(item.id)}"${item.id === machineId ? ' selected' : ''}>${esc(item.code)}</option>`)).join('');
  const kinds = DOC_KINDS.map((item) => `<option value="${esc(item.code)}"${item.code === pick('kind', doc?.kind || 'manual') ? ' selected' : ''}>${esc(item.name)}</option>`).join('');
  return `${head(doc ? '編輯文件' : '加入文件', 'Document', '可在線預覽')}
    <section class="ef-panel"><form class="ef-form stack" id="doc-form">
      ${extras.notice || ''}
      ${field('名稱', 'title', pick('title', doc?.title || ''))}
      <label class="field"><span>類別</span><select name="kind">${kinds}</select></label>
      <label class="field"><span>機械</span><select name="machineId">${options}</select></label>
      <label class="field"><span>檔案</span><input name="file" type="file" accept="image/*,.pdf,application/pdf"><small>圖片或 PDF。${doc?.href ? '留空則保留現有檔案。' : ''}</small></label>
      ${doc?.href ? `<p class="ef-actions"><button class="ef-btn small" type="button" data-act="preview-doc" data-id="${esc(doc.id)}" data-source="doc">預覽</button></p>` : ''}
      <p class="ef-actions">
        <button class="ef-btn go" type="button" data-act="save-doc" data-id="${esc(doc?.id || '')}">保存</button>
        ${doc ? `<button class="ef-btn danger" type="button" data-act="delete-doc" data-id="${esc(doc.id)}">刪除這份文件</button>` : ''}
        <a class="ef-btn" href="#/papers/docs">取消</a>
      </p>
    </form></section>`;
}

function renderDept(state) {
  const tree = orgTree(state.people, '', '');
  return `${head('部門組織圖', 'Organization', `共 ${state.people.length} 人`)}
    <p class="ef-lede">點選人員會打開用戶資料。</p>
    <div class="org-wrap">${tree || '<p class="ef-empty">還沒有人員。到用戶管理登記第一位之後，架構圖會出現。</p>'}</div>
    <p class="ef-actions" style="margin-top:1.5rem"><button class="ef-btn danger" type="button" data-act="reset-data">清除並恢復示例</button></p>`;
}

function renderUsers(state, query, extras) {
  const selected = query.person && query.person !== 'new' ? personById(query.person) : null;
  const creating = query.person === 'new';
  const rows = state.people.map((person) => {
    const role = ROLES.find((item) => item.code === person.role);
    const current = person.id === selected?.id;
    return `<li><a class="ef-record" href="#/users?person=${esc(person.id)}">
      <span class="ef-tag${current ? ' is-current' : ''}">${esc(person.name)}</span>
      <span class="ef-field">${esc(role?.zh || '')}</span>
      <span class="name">${esc(person.title)}</span>
      <span class="ef-field">${esc(person.company || '機械部')}</span>
    </a></li>`;
  }).join('');
  const panel = creating || selected
    ? personForm(state, creating ? null : selected, extras)
    : `<h2>人員</h2><p class="ef-empty">點選一位人員，或登記新人員。</p>
      <p class="ef-actions"><a class="ef-btn go" href="#/users?person=new">登記人員</a></p>`;
  return `${head('用戶管理', 'Users', `共 ${state.people.length} 人`)}
    <div class="dept-layout">
      <div><ul class="ef-records">${rows}</ul></div>
      <section class="ef-panel">${panel}</section>
    </div>`;
}

function renderLater(zh, en, sentence) {
  return `${head(zh, en, '尚未開放')}<p class="ef-empty">${esc(sentence)}</p>`;
}

function renderStores() {
  return `${head('物資', 'Stores', '尚未開放')}
    <p class="ef-empty">庫存、領用和採購會在這裡列出。這一部分尚未開放。</p>`;
}

function personForm(state, person, extras) {
  const cache = extras.formCache || {};
  const pick = (key, fallback = '') => (key in cache ? cache[key] : person?.[key] ?? fallback);
  const reportsTo = pick('reportsTo');
  const role = pick('role', person ? '' : 'tech');
  const company = pick('company');
  const blocked = new Set(person ? [person.id, ...descendantsOf(state, person.id)] : []);
  const bosses = state.people.filter((item) => !blocked.has(item.id));
  const bossOptions = [`<option value="">沒有上司</option>`].concat(bosses.map((item) => `<option value="${esc(item.id)}"${reportsTo === item.id ? ' selected' : ''}>${esc(item.name)} ${esc(item.title)}</option>`)).join('');
  const roles = ROLES.map((item) => `<option value="${esc(item.code)}"${role === item.code ? ' selected' : ''}>${esc(item.zh)}</option>`).join('');
  const companies = [`<option value="">不指定</option>`].concat(COMPANIES.map((item) => `<option value="${esc(item)}"${company === item ? ' selected' : ''}>${esc(item)}</option>`)).join('');
  return `<h2>${person ? '編輯人員' : '登記人員'}</h2>
    <form class="ef-form stack" id="person-form">
      ${extras.notice || ''}
      ${field('姓名', 'name', pick('name'))}
      ${field('職位', 'title', pick('title'))}
      <label class="field"><span>崗位</span><select name="role">${roles}</select></label>
      <label class="field"><span>上司</span><select name="reportsTo">${bossOptions}</select></label>
      <label class="field"><span>所屬公司</span><select name="company">${companies}</select></label>
      ${field('電話', 'phone', pick('phone'))}
      <p class="ef-actions">
        <button class="ef-btn go" type="button" data-act="save-person" data-id="${esc(person?.id || '')}">保存</button>
        ${person ? `<button class="ef-btn danger" type="button" data-act="delete-person" data-id="${esc(person.id)}">刪除這位人員</button>` : ''}
        <a class="ef-btn" href="#/users">取消</a>
      </p>
    </form>`;
}

function orgTree(people, parentId, currentId) {
  const nodes = people.filter((person) => (person.reportsTo || '') === parentId);
  if (!nodes.length) return '';
  return `<ul class="${parentId ? '' : 'org-tree'}">${nodes.map((person) => {
    const role = ROLES.find((item) => item.code === person.role);
    const current = person.id === currentId;
    return `<li class="org-node"><button type="button" class="org-card${current ? ' is-current' : ''}" data-act="select-person" data-id="${esc(person.id)}"${current ? ' aria-current="true"' : ''}>
      <span class="ef-eyebrow">${esc(role?.en || '')}</span><strong>${esc(person.name)}</strong><em>${esc(person.title)}</em>
    </button>${orgTree(people, person.id, currentId)}</li>`;
  }).join('')}</ul>`;
}

function descendantsOf(state, id) {
  const out = [];
  const walk = (parent) => {
    for (const person of state.people.filter((item) => item.reportsTo === parent)) {
      out.push(person.id);
      walk(person.id);
    }
  };
  walk(id);
  return out;
}

function renderMissing() {
  return `${head('沒有這一頁', 'Missing', '')}<p class="ef-empty">這個位置還沒有內容。<a href="#/">返回首頁</a></p>`;
}

function missingRecord(name, href) {
  return `${head(name, 'Missing', '')}<p class="ef-empty">找不到這項紀錄。<a href="${href}">返回</a></p>`;
}

function head(zh, en, text) {
  return `<header class="ef-head"><h1 tabindex="-1">${esc(zh)} <small>${esc(en)}</small></h1><p>${esc(text)}</p></header>`;
}

function searchBox(label, value) {
  return `<label class="ef-search"><input data-search value="${esc(value || '')}" placeholder="${esc(label)}" aria-label="${esc(label)}"></label>`;
}

function chipRow(label, items, key, current) {
  return `<div class="filters" role="group" aria-label="${esc(label)}">${items.map(([value, text, count]) => {
    const on = current === value;
    return `<button type="button" class="ef-chip${on ? ' is-active' : ''}" aria-pressed="${on}" data-act="filter" data-key="${esc(key)}" data-value="${esc(value)}">${esc(text)} <span class="n">${count}</span></button>`;
  }).join('')}</div>`;
}

function filterChip(text, count, on, act, value) {
  return `<button type="button" class="ef-chip${on ? ' is-active' : ''}" aria-pressed="${on}" data-act="${act}" data-value="${esc(value)}">${esc(text)} <span class="n">${count}</span></button>`;
}

function field(label, name, value, hint = '', type = 'text', extra = '') {
  const step = type === 'number' ? ' step="any"' : '';
  return `<label class="field${extra ? ` ${extra}` : ''}"><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}"${step}>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

function fieldEditor(rows) {
  const body = rows.length
    ? rows.map((row, index) => `<div class="spec-row is-pair">
        <label class="field"><span>名稱</span><input name="fieldLabel" value="${esc(row.label)}" placeholder="例如 主臂長度"></label>
        <label class="field"><span>單位</span><input name="fieldUnit" value="${esc(row.unit)}" placeholder="例如 m"></label>
        <input type="hidden" name="fieldKey" value="${esc(row.key || '')}">
        <button class="ef-btn small danger" type="button" data-act="remove-spec" data-index="${index}">刪除這項</button>
      </div>`).join('')
    : '<p class="ef-empty">還沒有預設欄。新增之後，登記這類機械時會先列出來。</p>';
  return `<div class="spec-list">${body}</div>
    <p class="ef-actions"><button class="ef-btn" type="button" data-act="add-spec">新增一項</button></p>`;
}

function specEditor(rows) {
  const body = rows.length
    ? rows.map((row, index) => `<div class="spec-row">
        <label class="field"><span>名稱</span><input name="specLabel" value="${esc(row.label)}" placeholder="例如 出風量"></label>
        <label class="field"><span>數值</span><input name="specValue" value="${esc(row.value)}"></label>
        <label class="field"><span>單位</span><input name="specUnit" value="${esc(row.unit)}" placeholder="例如 m³/min"></label>
        <button class="ef-btn small danger" type="button" data-act="remove-spec" data-index="${index}">刪除這項</button>
      </div>`).join('')
    : '<p class="ef-empty">還沒有特定數據。新增之後會跟這台機械一起保存。</p>';
  return `<div class="spec-list">${body}</div>
    <p class="ef-actions"><button class="ef-btn" type="button" data-act="add-spec">新增一項</button></p>`;
}

function selectField(label, name, options, current, extra = '') {
  const opts = options.map(([value, text]) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(text)}</option>`).join('');
  return `<label class="field"><span>${esc(label)}</span><select name="${esc(name)}" ${extra}>${opts}</select></label>`;
}

function machineRecord(machine, first) {
  const type = typeOf(machine.type);
  return `<li><a class="ef-record" href="#/machines/${esc(machine.code)}">
    <span class="ef-tag${first ? ' is-current' : ''}">${esc(machine.code)}</span>
    <span class="ef-field">${esc(machine.yearMade)}</span>
    <span class="name">${esc(type?.name || '')} ${esc(machine.manufacturer)} ${esc(machine.model)} <span class="ef-state ${stateClass(machine.status)}">${esc(machine.status)}</span></span>
    <span class="ef-field">${num(machine.hours)} 機鐘</span>
  </a></li>`;
}

function repairRecord(state, repair, first) {
  const subject = repairSubject(state, repair);
  const totals = repairTotals(repair);
  const label = repair.status === 'draft' ? '草稿' : repair.status === 'open' ? '進行中' : '已完成';
  const cls = repair.status === 'open' ? 'is-alert' : repair.status === 'draft' ? 'is-draft' : '';
  const dates = repair.sessions.map((session) => session.date).filter(Boolean);
  const when = latestDate(repair);
  const spot = [...repair.sessions].reverse().find((session) => session.date === when)?.location
    || repair.sessions.at(-1)?.location
    || '';
  const days = new Set(dates).size || (repair.openedOn ? 1 : 0);
  return `<li><a class="ef-record is-repair" href="#/repairs/${esc(repair.number)}">
    <span class="ef-tag${first ? ' is-current' : ''}">${esc(repair.number)}</span>
    <span class="ef-field">${esc(fmtDate(when))}</span>
    <span class="ef-field">${esc(spot || '—')}</span>
    <span class="ef-field">${esc(subject.code)}</span>
    <span><span class="ef-state ${cls}">${label}</span></span>
    <span class="ef-field">${days} 日 · ${esc(fmtMinutes(totals.total))}</span>
  </a></li>`;
}

function repairSubject(state, repair) {
  if (repair.assetKind === 'engine') {
    const engine = (state.engines || []).find((item) => item.id === repair.engineId);
    return {
      code: engine?.code || '引擎',
      name: '引擎',
      href: engine ? `#/engines/${encodeURIComponent(engine.code)}` : '#/engines',
    };
  }
  const machine = machineById(repair.machineId);
  return {
    code: machine?.code || '—',
    name: typeOf(machine?.type)?.name || '',
    href: machine ? `#/machines/${encodeURIComponent(machine.code)}` : '#/machines',
  };
}

function certRecord(state, cert) {
  const machine = machineById(cert.machineId);
  const form = certForm(cert.form);
  const timing = certTiming(cert);
  const flag = timing.state === 'expired' ? '已過期' : timing.state === 'due' ? `餘 ${timing.days} 日` : timing.state === 'none' ? '無到期日' : '有效';
  const cls = timing.state === 'expired' || timing.state === 'due' ? 'is-alert' : timing.state === 'none' ? 'is-draft' : '';
  return `<li><a class="ef-record" href="#/papers/cert/${esc(cert.id)}">
    <span class="ef-tag">${esc(form?.name || cert.form)}</span>
    <span class="ef-field">${esc(fmtDate(cert.expiresOn))}</span>
    <span class="name">${esc(machine?.code || '—')} ${esc(cert.number)} <span class="ef-state ${cls}">${esc(flag)}</span></span>
    <span class="ef-field">${esc(form?.group === 'env' ? '環保' : '法定')}</span>
  </a></li>`;
}

function docRecord(doc) {
  const machine = machineById(doc.machineId);
  const kind = DOC_KINDS.find((item) => item.code === doc.kind);
  return `<li><button type="button" class="ef-record" data-act="preview-doc" data-id="${esc(doc.id)}" data-source="doc">
    <span class="ef-tag">${esc(kind?.name || '文件')}</span>
    <span class="ef-field">${esc(machine?.code || '通用')}</span>
    <span class="name">${esc(doc.title)}</span>
    <span class="ef-field">預覽</span>
  </button></li>`;
}

function specRowsOf(machine) {
  if (Array.isArray(machine.specList)) return machine.specList;
  const type = typeOf(machine.type);
  if (!type) return [];
  return type.fields.map((field) => ({
    label: field.label,
    unit: field.unit,
    value: field.key ? machine.specs?.[field.key] || '' : '',
  }));
}

function specItems(machine) {
  const rows = specRowsOf(machine);
  if (!rows.length) return '<p class="ef-empty">這台機械還沒有特定數據。編輯時可以新增。</p>';
  return `<ul class="ef-ledger">${rows.map((row) => {
    const shown = String(row.value || '').trim();
    const unit = shown && row.unit ? ` ${row.unit}` : '';
    return `<li><span>${esc(row.label)}</span><span class="ef-field">${shown ? `${esc(shown)}${esc(unit)}` : '—'}</span></li>`;
  }).join('')}</ul>`;
}

function stepBar(current) {
  return `<ol class="steps">${STEPS.map((name, index) => {
    const n = index + 1;
    const cls = n < current ? 'is-done' : n === current ? 'is-current' : 'is-future';
    const inner = `<b>${String(n).padStart(2, '0')}</b>${esc(name)}`;
    if (n < current) return `<li class="${cls}"><button type="button" data-act="step" data-step="${n}">${inner}</button></li>`;
    if (n === current) return `<li class="${cls}" aria-current="step"><span>${inner}</span></li>`;
    return `<li class="${cls}"><span>${inner}</span></li>`;
  }).join('')}</ol>`;
}

function lockedAsset(state, draft, repair) {
  const tail = repair ? ` · ${esc(repair.number)}` : '';
  if (draft?.assetKind === 'engine') {
    const engine = (state.engines || []).find((item) => item.id === draft.engineId);
    if (!engine) return '';
    return `<p class="ef-lede">維修設備 <a href="#/engines/${esc(engine.code)}">${esc(engine.code)} 引擎</a>${tail}。</p>`;
  }
  const machine = machineById(draft?.machineId);
  if (!machine) return '';
  const type = typeOf(machine.type);
  return `<p class="ef-lede">維修設備 <a href="#/machines/${esc(machine.code)}">${esc(machine.code)} ${esc(type?.name || '')}</a>${tail}。</p>`;
}

function shiftBox(shift) {
  if (!shift) return '<p class="ef-notice" data-flag="注意">請填寫開始和結束時間。</p>';
  const note = shift.overnight ? '<p class="ef-notice" data-flag="跨日">結束時間不晚於開始，這次會當成跨日計算。</p>' : '';
  return `${note}<span class="ef-kv"><span>正班</span><span>${esc(fmtMinutes(shift.regularMin))}</span></span>
    <span class="ef-kv"><span>加班</span><span>${esc(fmtMinutes(shift.otMin))}</span></span>
    <span class="ef-kv"><span>合計</span><span>${esc(fmtMinutes(shift.totalMin))}</span></span>`;
}

function partRow(part, index) {
  return `<div class="part-row">
    ${field('零件', 'partName', part.name)}
    ${field('數量', 'partQty', part.qty || '1')}
    ${field('零件編號', 'partNo', part.partNo || '')}
    <button class="ef-btn small" type="button" data-act="remove-part" data-index="${index}">移除</button>
  </div>`;
}

function typeOf(code) {
  return liveTypes.find((item) => item.code === code) || null;
}

function fmtStamp(value) {
  const [date, time] = String(value || '').split(' ');
  return `${fmtDate(date)}${time ? ` ${time}` : ''}`;
}

function certForm(code) {
  return CERT_FORMS.find((item) => item.code === code) || null;
}

function findCode(state, code) {
  if (!code) return null;
  return state.machines.find((item) => item.code === code) || null;
}

function sessionInRange(repair, from, to) {
  const dates = repair.sessions.map((session) => session.date).filter(Boolean);
  const list = dates.length ? dates : [repair.openedOn].filter(Boolean);
  return list.some((date) => (!from || date >= from) && (!to || date <= to));
}

function latestDate(repair) {
  const dates = repair.sessions.map((session) => session.date).sort();
  return dates.at(-1) || repair.openedOn;
}

function stateClass(status) {
  if (status === '維修中') return 'is-alert';
  if (status === '停用') return 'is-hidden';
  if (status === '調遷') return 'is-draft';
  return '';
}

function num(value) {
  return Number(value || 0).toLocaleString('en-HK');
}

export function machineNeedsLook(state, machine) {
  if (machine.status === '維修中') return true;
  return state.certificates.some((cert) => cert.machineId === machine.id && ['due', 'expired'].includes(certTiming(cert).state));
}
