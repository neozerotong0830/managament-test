import { esc } from './format.js';

const HKO = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';

export function mountWeather(root) {
  const box = root.querySelector('[data-weather]');
  const live = root.querySelector('[data-live-warn]');
  if (!box) return;
  const token = {};
  box._wx = token;
  loadForecast()
    .then((data) => {
      if (box._wx !== token || !box.isConnected) return;
      const slot = box.querySelector('[data-wx]');
      if (slot) slot.innerHTML = forecastHtml(data);
      if (live && live.isConnected) live.innerHTML = warningHtml(data.warnings);
    })
    .catch(() => {
      if (box._wx !== token || !box.isConnected) return;
      const slot = box.querySelector('[data-wx]');
      if (slot) slot.innerHTML = '<p class="ef-empty">暫時讀不到香港天文台的預報。重新整理後可以再試。</p>';
    });
}

async function loadForecast() {
  const [now, forecast, warnings] = await Promise.all([
    read('rhrread'),
    read('fnd'),
    read('warnsum'),
  ]);
  const temp = now.temperature?.data?.find((item) => item.place === '香港天文台') || now.temperature?.data?.[0];
  const humidity = now.humidity?.data?.[0];
  const days = (forecast.weatherForecast || []).slice(0, 5).map((day) => ({
    date: `${day.forecastDate.slice(4, 6)}.${day.forecastDate.slice(6, 8)}`,
    week: String(day.week || '').replace('星期', '周'),
    weather: day.forecastWeather,
    max: day.forecastMaxtemp?.value,
    min: day.forecastMintemp?.value,
  }));
  const active = Object.values(warnings || {}).filter((item) => item && item.name && item.actionCode && item.actionCode !== 'CANCEL');
  return {
    place: temp?.place || '香港天文台',
    temp: temp?.value,
    humidity: humidity?.value,
    days,
    warnings: active,
  };
}

function read(type) {
  return fetch(`${HKO}?dataType=${type}&lang=tc`).then((response) => {
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  });
}

function forecastHtml(data) {
  if (!data.days.length && data.temp == null) {
    return '<p class="ef-empty">香港天文台暫時沒有可顯示的預報。</p>';
  }
  const today = data.days[0];
  const days = data.days.map((day) => `<li><span>${esc(day.date)} ${esc(day.week)}</span><span class="ef-field">${esc(day.min)}–${esc(day.max)}°C</span></li>`).join('');
  return `<p class="wx-now">${data.temp == null ? '—' : esc(data.temp)}<span>°C</span></p>
    <p class="ef-field">${esc(data.place)}${data.humidity == null ? '' : ` │ 濕度 ${esc(data.humidity)}%`}</p>
    ${today ? `<p class="wx-text">${esc(today.weather)}</p>` : ''}
    ${days ? `<ul class="ef-ledger">${days}</ul>` : ''}`;
}

function warningHtml(warnings) {
  return warnings.map((item) => `<p class="ef-notice" data-flag="天氣">${esc(item.name)}生效。</p>`).join('');
}
