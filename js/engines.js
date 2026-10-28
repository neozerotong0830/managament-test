/** Mount rules and hour linkage. Kept free of storage so the checks can call them directly. */

export function hourDelta(previous, next) {
  const from = Number(previous);
  const to = Number(next);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return to - from;
}

export function meterPunch(previousFace, cumulative, reading) {
  const face = Number(previousFace);
  const total = Number(cumulative);
  const next = Number(reading);
  if (!Number.isFinite(face) || !Number.isFinite(total) || !Number.isFinite(next) || next < 0) return null;
  const replaced = next < face;
  const run = replaced ? next : next - face;
  return { replaced, run, cumulative: total + run, reading: next };
}

export function applyHourLink(engineHours, previousMachineHours, nextMachineHours) {
  const delta = hourDelta(previousMachineHours, nextMachineHours);
  const base = Number(engineHours);
  const safe = Number.isFinite(base) ? base : 0;
  return { delta, engineHours: safe + delta };
}

export function engineIsRepairing(engine, repairs) {
  if (!engine) return false;
  return (repairs || []).some((item) => item.status === 'open' && item.assetKind === 'engine' && item.engineId === engine.id);
}

export function engineStatusCode(engine, repairing) {
  if (repairing) return 'repair';
  if (engine?.mountedMachineId) return 'mounted';
  return 'stock';
}

export function engineStatusText(engine, hostCode, repairing) {
  if (repairing) return '維修中';
  if (engine?.mountedMachineId) return `已安裝於 ${hostCode || '—'}`;
  return '庫存中';
}

export function canMount({ engine, machine, type, engines, repairing }) {
  if (!engine) return { ok: false, reason: '找不到這台引擎。' };
  if (repairing) return { ok: false, reason: '維修中的引擎不能安裝。' };
  if (engine.mountedMachineId) return { ok: false, reason: '這台引擎已經安裝在機械上。' };
  if (!machine) return { ok: false, reason: '請選擇要安裝的機械。' };
  if (!type?.mountsEngine) return { ok: false, reason: '這類機械不能安裝引擎。' };
  if ((engines || []).some((item) => item.id !== engine.id && item.mountedMachineId === machine.id)) {
    return { ok: false, reason: '這台機械已經安裝了引擎。' };
  }
  return { ok: true, reason: '' };
}

export function trailStamp(date = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())} ${z(date.getHours())}:${z(date.getMinutes())}`;
}
