import { esc } from './format.js';
import { machineNeedsLook, renderMapCard } from './pages.js';
import { getState } from './store.js';

let map = null;

export function destroyMap() {
  if (!map) return;
  map.remove();
  map = null;
}

export function mountMap(selectedCode) {
  const el = document.getElementById('hk-map');
  if (!el) return;
  if (!window.L) {
    el.innerHTML = '<p class="ef-empty">地圖未能載入。請檢查網絡後再打開這一頁。</p>';
    return;
  }
  const state = getState();
  map = window.L.map(el, { zoomControl: true }).setView([22.35, 114.15], 11);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);
  for (const machine of state.machines) {
    const look = machineNeedsLook(state, machine);
    const current = machine.code === selectedCode;
    const icon = window.L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin${look ? ' is-alert' : ''}${current ? ' is-current' : ''}">${esc(machine.code)}</div>`,
      iconSize: [68, 28],
      iconAnchor: [34, 14],
    });
    const marker = window.L.marker([Number(machine.lat), Number(machine.lng)], {
      icon,
      keyboard: true,
      title: machine.code,
    }).addTo(map);
    marker.on('click', () => focusMachine(machine.code));
  }
  const selected = state.machines.find((item) => item.code === selectedCode);
  if (selected) map.setView([Number(selected.lat), Number(selected.lng)], 13);
  const card = document.getElementById('map-card');
  if (card) card.innerHTML = renderMapCard(selected || null);
}

export function focusMachine(code) {
  const state = getState();
  const machine = state.machines.find((item) => item.code === code);
  if (!machine || !map) return;
  const next = `#/map?at=${encodeURIComponent(code)}`;
  if (location.hash !== next) history.replaceState(null, '', next);
  map.setView([Number(machine.lat), Number(machine.lng)], Math.max(map.getZoom(), 13));
  document.querySelectorAll('.pin').forEach((pin) => {
    pin.classList.toggle('is-current', pin.textContent.trim() === code);
  });
  document.querySelectorAll('#map-list .ef-tag').forEach((tag) => {
    tag.classList.toggle('is-current', tag.textContent.trim() === code);
  });
  const card = document.getElementById('map-card');
  if (card) card.innerHTML = renderMapCard(machine);
}
