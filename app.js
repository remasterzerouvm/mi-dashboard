/* Dashboard de Emanuel — vanilla JS, sin dependencias. */
(function () {
  'use strict';
  var TZ = 'America/Monterrey';
  var LAT = 25.78, LON = -100.19;
  var DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var state = { data: null, tab: 'hoy', week: null };

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? esc(u) : '#'; }
  function fmt(d, opts) { return new Intl.DateTimeFormat('es-MX', Object.assign({ timeZone: TZ }, opts)).format(d); }
  function ymd(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  function hourIn(d) { return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d), 10) % 24; }
  function hm(d) { return fmt(d, { hour: '2-digit', minute: '2-digit', hour12: false }); }
  function addDays(dateStr, n) { var d = new Date(dateStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function weekdayOf(dateStr) { return new Date(dateStr + 'T12:00:00Z').getUTCDay(); }
  function dayLabel(dateStr) {
    var today = ymd(new Date());
    if (dateStr === today) return 'Hoy';
    if (dateStr === addDays(today, 1)) return 'Mañana';
    var d = new Date(dateStr + 'T12:00:00Z');
    return DAYS_ES[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' }).format(d).replace('.', '');
  }
  function rel(iso) {
    if (!iso) return '';
    var diff = (Date.now() - new Date(iso).getTime()) / 60000;
    if (diff < 1) return 'ahora';
    if (diff < 60) return 'hace ' + Math.round(diff) + ' min';
    if (diff < 60 * 24) return 'hace ' + Math.round(diff / 60) + ' h';
    return 'hace ' + Math.round(diff / 1440) + ' d';
  }
  function until(ts) {
    var m = Math.round((ts * 1000 - Date.now()) / 60000);
    if (m <= 0) return null;
    if (m < 60) return 'en ' + m + ' min';
    if (m < 24 * 60) return 'en ' + Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
    return '';  // more than a day away: the day label already says when
  }

  // ---------- header ----------
  function renderHeader() {
    var now = new Date(), h = hourIn(now);
    var g = h >= 5 && h < 12 ? 'Buenos días' : (h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches');
    $('greeting').textContent = g + ', Emanuel';
    var ds = fmt(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('date').textContent = ds.charAt(0).toUpperCase() + ds.slice(1);
  }

  // ---------- theme ----------
  $('themeBtn').addEventListener('click', function () {
    var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) {}
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0a0f1e' : '#f4f6fb');
  });

  // ---------- weather ----------
  var WMO = {
    0: ['Despejado', '☀️', '🌙'], 1: ['Mayormente despejado', '🌤️', '🌙'], 2: ['Parcialmente nublado', '⛅', '☁️'],
    3: ['Nublado', '☁️', '☁️'], 45: ['Niebla', '🌫️'], 48: ['Niebla con escarcha', '🌫️'],
    51: ['Llovizna ligera', '🌦️', '🌧️'], 53: ['Llovizna', '🌦️', '🌧️'], 55: ['Llovizna intensa', '🌧️'],
    56: ['Llovizna helada', '🌧️'], 57: ['Llovizna helada intensa', '🌧️'],
    61: ['Lluvia ligera', '🌦️', '🌧️'], 63: ['Lluvia', '🌧️'], 65: ['Lluvia intensa', '🌧️'],
    66: ['Lluvia helada', '🌧️'], 67: ['Lluvia helada intensa', '🌧️'],
    71: ['Nevada ligera', '🌨️'], 73: ['Nevada', '🌨️'], 75: ['Nevada intensa', '❄️'], 77: ['Granos de nieve', '🌨️'],
    80: ['Chubascos ligeros', '🌦️', '🌧️'], 81: ['Chubascos', '🌧️'], 82: ['Chubascos fuertes', '⛈️'],
    85: ['Chubascos de nieve', '🌨️'], 86: ['Chubascos de nieve fuertes', '❄️'],
    95: ['Tormenta eléctrica', '⛈️'], 96: ['Tormenta con granizo', '⛈️'], 99: ['Tormenta con granizo fuerte', '⛈️']
  };
  function wx(code, isDay) {
    var w = WMO[code] || ['—', '🌡️'];
    return { label: w[0], icon: (isDay === 0 && w[2]) ? w[2] : w[1] };
  }
  function dirName(deg) {
    if (deg == null) return '';
    return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(deg / 45) % 8];
  }
  function r0(x) { return x == null ? '–' : Math.round(x); }

  function tipFor(w) {
    var now = new Date(), h = hourIn(now), di = h >= 19 ? 1 : 0, d = w.daily, tips = [];
    var prefix = di === 1 ? 'Mañana: ' : '';
    var pmax = d.precipitation_probability_max[di] || 0, psum = d.precipitation_sum[di] || 0;
    var tmax = d.temperature_2m_max[di], tmin = d.temperature_2m_min[di], amax = d.apparent_temperature_max ? d.apparent_temperature_max[di] : tmax;
    var uv = d.uv_index_max ? d.uv_index_max[di] : 0, gust = d.wind_gusts_10m_max ? d.wind_gusts_10m_max[di] : 0;
    if (pmax >= 60 || psum >= 3) tips.push('☂️ Lleva paraguas: ' + pmax + '% de probabilidad de lluvia' + (psum ? ' (~' + psum.toFixed(1) + ' mm)' : '') + '.');
    else if (pmax >= 30 || psum >= 0.5) tips.push('🌂 Por si acaso, trae un paraguas pequeño (' + pmax + '% de lluvia).');
    if (tmin <= 10) tips.push('🧥 Abrígate bien: mínima de ' + r0(tmin) + '°.');
    else if (tmin <= 16) tips.push('🧥 Una chamarra ligera para la mañana/noche (mín. ' + r0(tmin) + '°).');
    if (amax >= 35 || tmax >= 34) tips.push('💧 Hidrátate y evita el sol de mediodía (sensación de hasta ' + r0(amax) + '°).');
    else if (uv >= 8 && pmax < 60) tips.push('🧴 UV muy alto (' + r0(uv) + '): usa bloqueador.');
    if (gust >= 50) tips.push('💨 Rachas de viento de hasta ' + r0(gust) + ' km/h.');
    if (!tips.length) tips.push('😎 Clima agradable: buen día para salir.');
    return prefix + tips.slice(0, 2).join(' ');
  }

  function renderWeather(w) {
    var c = w.current, d = w.daily, hNow = wx(c.weather_code, c.is_day);
    // next 12 hours starting at the current hour
    var curHour = c.time.slice(0, 13), idx = w.hourly.time.findIndex(function (t) { return t.slice(0, 13) === curHour; });
    if (idx < 0) idx = 0;
    var hours = '';
    for (var i = idx; i < Math.min(idx + 12, w.hourly.time.length); i++) {
      var hx = wx(w.hourly.weather_code[i], w.hourly.is_day[i]), p = w.hourly.precipitation_probability[i];
      hours += '<div class="hour' + (i === idx ? ' now-h' : '') + '"><div class="t">' + (i === idx ? 'Ahora' : w.hourly.time[i].slice(11, 16)) +
        '</div><div class="e" title="' + esc(hx.label) + '">' + hx.icon + '</div><div class="v">' + r0(w.hourly.temperature_2m[i]) +
        '°</div><div class="p">' + (p >= 10 ? '💧' + p + '%' : '&nbsp;') + '</div></div>';
    }
    var days = '';
    for (var j = 0; j < Math.min(5, d.time.length); j++) {
      var dx = wx(d.weather_code[j], 1), dd = new Date(d.time[j] + 'T12:00:00Z');
      var name = j === 0 ? 'Hoy' : DAYS_ES[dd.getUTCDay()].slice(0, 3);
      days += '<div class="day"><div class="d">' + name + '</div><div class="e" title="' + esc(dx.label) + '">' + dx.icon +
        '</div><div class="mm">' + r0(d.temperature_2m_max[j]) + '° <span>' + r0(d.temperature_2m_min[j]) + '°</span></div>' +
        '<div class="p">💧' + (d.precipitation_probability_max[j] || 0) + '%</div></div>';
    }
    $('weatherBody').innerHTML =
      '<div class="now"><div class="now-icon" aria-hidden="true">' + hNow.icon + '</div><div>' +
      '<div class="now-temp">' + r0(c.temperature_2m) + '<sup>°C</sup></div>' +
      '<div class="now-desc">' + esc(hNow.label) + '</div>' +
      '<div class="now-sub">Sensación ' + r0(c.apparent_temperature) + '° · Máx ' + r0(d.temperature_2m_max[0]) + '° / Mín ' + r0(d.temperature_2m_min[0]) + '°</div>' +
      '</div></div>' +
      '<div class="chips">' +
      '<span class="chip">💧 Lluvia ' + (d.precipitation_probability_max[0] || 0) + '% · ' + (d.precipitation_sum[0] || 0).toFixed(1) + ' mm</span>' +
      '<span class="chip">💨 ' + r0(c.wind_speed_10m) + ' km/h ' + dirName(c.wind_direction_10m) + (c.wind_gusts_10m ? ' · ráfagas ' + r0(c.wind_gusts_10m) : '') + '</span>' +
      '<span class="chip">💦 Humedad ' + r0(c.relative_humidity_2m) + '%</span>' +
      (d.uv_index_max ? '<span class="chip">🔆 UV ' + r0(d.uv_index_max[0]) + '</span>' : '') +
      (d.sunset ? '<span class="chip">🌇 ' + d.sunset[0].slice(11, 16) + '</span>' : '') +
      '</div>' +
      '<div class="tip">' + esc(tipFor(w)) + '</div>' +
      '<div class="sub-h">Próximas 12 horas</div><div class="hours">' + hours + '</div>' +
      '<div class="sub-h">5 días</div><div class="days">' + days + '</div>';
    $('weatherUpdated').textContent = 'Clima en vivo de Open-Meteo · ' + hm(new Date());
  }

  function loadWeather() {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
      '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,precipitation_probability_max,uv_index_max,wind_gusts_10m_max,sunset' +
      '&timezone=' + encodeURIComponent(TZ) + '&forecast_days=6&wind_speed_unit=kmh';
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(renderWeather)
      .catch(function (e) {
        console.warn('clima', e);
        $('weatherBody').innerHTML = '<div class="empty">No se pudo cargar el clima ahora. <br><span class="tiny">' + esc(e.message) + '</span></div>';
      });
  }

  // ---------- news ----------
  var TIER = { local: ['Local', 'b-local'], national: ['Nacional', 'b-national'], intl: ['Internacional', 'b-intl'] };
  function renderNews(d) {
    var list = d.news || [];
    if (!list.length) {
      $('newsList').innerHTML = '<li class="empty">Sin noticias por ahora.</li>';
    } else {
      $('newsList').innerHTML = list.map(function (n) {
        var t = TIER[n.tier] || ['', ''];
        return '<li class="news-item"><div class="meta"><span class="badge ' + t[1] + '">' + t[0] + '</span><span>' + esc(n.source) +
          '</span>' + (n.published ? '<span>·</span><time datetime="' + esc(n.published) + '" title="' + esc(fmt(new Date(n.published), { dateStyle: 'medium', timeStyle: 'short' })) + '">' + rel(n.published) + '</time>' : '') +
          '</div><a class="title" href="' + safeUrl(n.link) + '" target="_blank" rel="noopener noreferrer">' + esc(n.title) + '</a>' +
          (n.summary ? '<p>' + esc(n.summary) + '</p>' : '') + '</li>';
      }).join('');
    }
    $('newsMeta').textContent = list.length ? list.length + ' titulares' : '';
    var tr = d.trends || [];
    if (tr.length) {
      var meta = d.trends_meta || {};
      $('trends').innerHTML = '<span class="lbl">𝕏 Tendencias' + (meta.place ? ' · ' + esc(meta.place) : '') + '</span>' +
        tr.slice(0, 12).map(function (t) {
          return '<a class="chip trend" href="' + safeUrl(t.url) + '" target="_blank" rel="noopener noreferrer">' + esc(t.name) + '</a>';
        }).join('');
      if (meta.fetched_at) $('trends').title = 'Tendencias ' + rel(meta.fetched_at);
      $('trends').hidden = false;
    } else {
      $('trends').hidden = true;
    }
  }

  // ---------- anime ----------
  function titleMap() {
    var m = {};
    ((state.data && state.data.anime && state.data.anime.titles) || []).forEach(function (t) { m[t.key] = t; });
    return m;
  }
  // First SubsPlease slot (weekday Mon=0 + HH:MM, Monterrey time) at/after the official airing, within 2 days.
  function subFor(t, airTs) {
    if (!t || !t.subsplease || !airTs) return null;
    var parts = t.subsplease.time.split(':'), base = ymd(new Date(airTs * 1000));
    for (var add = 0; add < 3; add++) {
      var ds = addDays(base, add);
      if ((weekdayOf(ds) + 6) % 7 !== t.subsplease.weekday) continue;
      var iso = ds + 'T' + parts[0].padStart(2, '0') + ':' + parts[1] + ':00-06:00'; // Monterrey has no DST (UTC-6)
      var ts = Math.floor(new Date(iso).getTime() / 1000);
      if (ts >= airTs - 1800) return { iso: iso, ts: ts };
    }
    return null;
  }
  function platformPills(t) {
    return (t.platforms || []).map(function (p) {
      var inner = '📺 ' + esc(p.name) + (p.note ? ' <span class="na">· ' + esc(p.note) + '</span>' : '');
      return p.url ? '<a class="pill" href="' + safeUrl(p.url) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>' : '<span class="pill">' + inner + '</span>';
    }).join('') || '<span class="pill muted">Plataforma sin anunciar</span>';
  }
  function cover(t) {
    return t.cover ? '<img src="' + safeUrl(t.cover) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<div class="ph"></div>';
  }
  function titleBlock(t) {
    var name = t.anilist_url ? '<a href="' + safeUrl(t.anilist_url) + '" target="_blank" rel="noopener noreferrer">' + esc(t.romaji || t.name) + '</a>' : esc(t.romaji || t.name);
    return '<div class="t1">' + name + '</div>' + (t.english ? '<div class="t2">' + esc(t.english) + '</div>' : '');
  }
  function timePills(ep) {
    var out = '', now = Date.now() / 1000;
    if (ep.estimated) out += '<span class="pill">🗓️ Estreno ' + esc(dayLabel(ep.date)) + ' (hora por confirmar)</span>';
    else if (ep.ts) {
      var u = until(ep.ts), aired = ep.ts <= now;
      out += '<span class="pill ' + (aired ? 'live' : (ep.ts - now < 3 * 3600 ? 'soon' : '')) + '">🇯🇵 Emisión ' + hm(new Date(ep.ts * 1000)) + (aired ? ' · ya salió' : (u ? ' · ' + u : '')) + '</span>';
    }
    if (ep.sub_ts) {
      var subOut = ep.sub_ts <= now;
      out += '<span class="pill ' + (subOut ? 'live' : '') + '">💬 Sub ' + hm(new Date(ep.sub_ts * 1000)) + (subOut ? ' ✓' : '') + '</span>';
    }
    return out;
  }
  function epCard(ep, t, opts) {
    opts = opts || {};
    return '<div class="ani">' + cover(t) + '<div>' + titleBlock(t) +
      '<div class="row"><span class="pill ep">Ep ' + esc(ep.episode) + (t.total_episodes ? '/' + t.total_episodes : '') + '</span>' +
      (opts.showDay ? '<span class="pill">' + esc(dayLabel(ep.date)) + '</span>' : '') + timePills(ep) + '</div>' +
      '<div class="row">' + platformPills(t) + '</div></div></div>';
  }
  function weekItems() {
    var tm = titleMap(), base = (state.week || (state.data.anime && state.data.anime.week) || []);
    return base.map(function (w) {
      var t = tm[w.key];
      var copy = Object.assign({}, w);
      if (!copy.estimated && copy.ts) {
        copy.date = ymd(new Date(copy.ts * 1000));
        var s = subFor(t, copy.ts);
        if (s) { copy.sub_ts = s.ts; copy.sub_at = s.iso; } else if (t && !t.subsplease) { copy.sub_ts = null; }
      }
      return copy;
    }).sort(function (a, b) { return a.ts - b.ts; });
  }
  function renderAnime() {
    var body = $('animeBody'), d = state.data;
    if (!d || !d.anime || !(d.anime.titles || []).length) { body.innerHTML = '<div class="empty">Sin datos de anime.</div>'; return; }
    var tm = titleMap(), items = weekItems(), today = ymd(new Date()), html = '';
    if (state.tab === 'hoy') {
      var todays = items.filter(function (w) { return w.date === today || (w.sub_ts && ymd(new Date(w.sub_ts * 1000)) === today); });
      if (todays.length) {
        html = '<div class="ani-list">' + todays.map(function (w) { return epCard(w, tm[w.key]); }).join('') + '</div>';
      } else {
        var next = items.filter(function (w) { return w.ts * 1000 > Date.now(); })[0];
        html = '<div class="empty">Hoy no sale ningún episodio nuevo de tu lista.' +
          (next ? '</div><div class="sub-h">Lo próximo</div><div class="ani-list">' + epCard(next, tm[next.key], { showDay: true }) + '</div>' : '</div>');
      }
    } else if (state.tab === 'semana') {
      var end = addDays(today, 7), groups = {};
      items.filter(function (w) { return w.date >= today && w.date < end; }).forEach(function (w) { (groups[w.date] = groups[w.date] || []).push(w); });
      var keys = Object.keys(groups).sort();
      html = keys.length ? keys.map(function (k) {
        return '<div class="day-group"><p class="day-label' + (k === today ? ' today' : '') + '">' + esc(dayLabel(k)) + '</p><div class="ani-list">' +
          groups[k].map(function (w) { return epCard(w, tm[w.key]); }).join('') + '</div></div>';
      }).join('') : '<div class="empty">No hay episodios en los próximos 7 días.</div>';
    } else {
      html = '<div class="ani-list">' + d.anime.titles.map(function (t) {
        var nx = items.filter(function (w) { return w.key === t.key && w.ts * 1000 > Date.now(); })[0];
        var info = nx ? '<span class="pill ep">Próx. ep ' + esc(nx.episode) + '</span><span class="pill">' + esc(dayLabel(nx.date)) + (nx.estimated ? '' : ' · ' + hm(new Date(nx.ts * 1000))) + '</span>'
          : (t.premiere ? '<span class="pill">Estreno ' + esc(t.premiere) + '</span>' : '');
        var dl = (t.downloaded || []).length ? '<span class="pill">⬇️ ep ' + esc(t.downloaded.join(', ')) + '</span>' : '';
        return '<div class="ani">' + cover(t) + '<div>' + titleBlock(t) + '<div class="row">' + info + dl + '</div><div class="row">' + platformPills(t) + '</div></div></div>';
      }).join('') + '</div>';
    }
    body.innerHTML = html;
  }
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () {
      state.tab = b.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(function (x) { var on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-selected', on); });
      renderAnime();
    });
  });

  // Optional live refresh of airing times from AniList (falls back to baked data silently).
  function refreshAniList() {
    var titles = (state.data.anime && state.data.anime.titles) || [];
    var ids = titles.map(function (t) { return t.anilist_id; }).filter(Boolean);
    if (!ids.length) return;
    var keyById = {}; titles.forEach(function (t) { if (t.anilist_id) keyById[t.anilist_id] = t.key; });
    var start = Math.floor(new Date(ymd(new Date()) + 'T00:00:00-06:00').getTime() / 1000);
    var q = 'query($ids:[Int],$a:Int,$b:Int){Page(perPage:50){airingSchedules(mediaId_in:$ids,airingAt_greater:$a,airingAt_lesser:$b,sort:TIME){mediaId episode airingAt}}}';
    fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: q, variables: { ids: ids, a: start - 1, b: start + 14 * 86400 } })
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var live = ((j.data && j.data.Page && j.data.Page.airingSchedules) || []).map(function (s) {
          return { key: keyById[s.mediaId], episode: s.episode, ts: s.airingAt, airing_at: new Date(s.airingAt * 1000).toISOString(), date: ymd(new Date(s.airingAt * 1000)) };
        });
        // keep baked "estimated" premieres for titles AniList still has no schedule for
        var have = {}; live.forEach(function (l) { have[l.key] = 1; });
        var est = (state.data.anime.week || []).filter(function (w) { return w.estimated && !have[w.key]; });
        state.week = live.concat(est);
        renderAnime();
      }).catch(function (e) { console.warn('anilist live', e); });
  }

  // ---------- data.json ----------
  function loadData() {
    return fetch('data.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        state.data = d;
        $('updated').textContent = d.generated_at ? fmt(new Date(d.generated_at), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' (hora de Monterrey) · ' + rel(d.generated_at) : '—';
        renderNews(d);
        renderAnime();
        refreshAniList();
      })
      .catch(function (e) {
        console.warn('data.json', e);
        state.data = { news: [], anime: { titles: [], week: [] }, trends: [] };
        $('newsList').innerHTML = '<li class="empty">No se pudo cargar data.json.</li>';
        $('animeBody').innerHTML = '<div class="empty">No se pudo cargar data.json.</div>';
      });
  }

  renderHeader();
  loadWeather();
  loadData();
  setInterval(renderHeader, 60 * 1000);
  setInterval(loadWeather, 15 * 60 * 1000);
  setInterval(loadData, 30 * 60 * 1000);
  setInterval(function () { if (state.data) renderAnime(); }, 5 * 60 * 1000);
})();
