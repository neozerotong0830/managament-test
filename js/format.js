import { SHIFT_END, SHIFT_START } from './catalog.js';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

export function today() {
  const d = new Date();
  return isoFromDate(d);
}

export function isoFromDate(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoFromDate(d);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${y}.${m}.${d}`;
}

export function daysUntil(iso, from = today()) {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${iso}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

/** Minutes of a session split into the 08:00–18:00 shift and time outside it. */
export function splitShift(start, end) {
  const toMin = (t) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(t || '');
    if (!match) return NaN;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 23 || m > 59) return NaN;
    return h * 60 + m;
  };
  let s = toMin(start);
  let e = toMin(end);
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  let overnight = false;
  if (e <= s) {
    e += 1440;
    overnight = true;
  }
  const day = 1440;
  let regular = 0;
  const day0 = Math.floor(s / day);
  const day1 = Math.floor((e - 1) / day);
  for (let d = day0; d <= day1; d += 1) {
    const a = Math.max(s, d * day);
    const b = Math.min(e, (d + 1) * day);
    const w0 = d * day + SHIFT_START;
    const w1 = d * day + SHIFT_END;
    regular += Math.max(0, Math.min(b, w1) - Math.max(a, w0));
  }
  const total = e - s;
  return { regularMin: regular, otMin: total - regular, totalMin: total, overnight };
}

export function fmtMinutes(min) {
  const n = Math.max(0, Math.round(min));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h} 小時 ${m} 分鐘`;
  if (h) return `${h} 小時`;
  return `${m} 分鐘`;
}

export function fmtClock(min) {
  const n = ((Math.round(min) % 1440) + 1440) % 1440;
  const z = (v) => String(v).padStart(2, '0');
  return `${z(Math.floor(n / 60))}:${z(n % 60)}`;
}

export function repairTotals(repair) {
  return repair.sessions.reduce(
    (acc, session) => {
      const part = splitShift(session.start, session.end);
      if (!part) return acc;
      acc.regular += part.regularMin;
      acc.ot += part.otMin;
      acc.total += part.totalMin;
      return acc;
    },
    { regular: 0, ot: 0, total: 0 },
  );
}

export function certTiming(cert, from = today()) {
  if (!cert.expiresOn) return { state: 'none', days: null };
  const days = daysUntil(cert.expiresOn, from);
  if (days < 0) return { state: 'expired', days };
  if (days <= Number(cert.leadDays || 0)) return { state: 'due', days };
  return { state: 'ok', days };
}

export function uid(prefix) {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

export function safeSrc(href) {
  if (!href) return '';
  if (href.startsWith('samples/')) return href;
  if (href.startsWith('data:image/')) return href;
  if (href.startsWith('data:application/pdf')) return href;
  return '';
}
