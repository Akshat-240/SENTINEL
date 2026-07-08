/* ==========================================================================
   SENTINEL — heatmap.js
   Leaflet map (CartoDB Voyager) + zone polygons + worker/sensor markers +
   Live/Historical/Play modes + detail panel + top-right notification panel.
   ========================================================================== */

(function () {
  'use strict';

  const ZONE_COORDS = {
    A: { lat: 17.6210, lng: 83.1840 },
    B: { lat: 17.6230, lng: 83.2020 },
    C: { lat: 17.6040, lng: 83.1860 },
    D: { lat: 17.6060, lng: 83.2040 },
  };

  const ZONE_AREA_NAME = {
    A: 'Sinter Plant',
    B: 'Coke Oven Battery',
    C: 'Blast Furnace Area',
    D: 'Steel Melt Shop',
  };

  const SENSOR_OFFSET = { lat: 0.0015, lng: 0.0018 };

  function factorsFor(gas, temp, permits) {
    return [
      { label: 'Gas', value: `${gas} PPM` },
      { label: 'Temperature', value: `${temp}°C` },
      { label: 'Permits', value: permits },
    ];
  }

  const TICKS = [
    {
      time: '09:01', event: null,
      zones: {
        A: { score: 12, level: 'normal', gas: 18, temp: 31, permits: 'None active', workers: [] },
        B: { score: 12, level: 'normal', gas: 20, temp: 33, permits: 'None active', workers: [] },
        C: { score: 22, level: 'normal', gas: 130, temp: 39, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:05', event: null,
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: { score: 18, level: 'normal', gas: 45, temp: 36, permits: 'None active', workers: [] },
        C: { score: 24, level: 'normal', gas: 138, temp: 39, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:07', event: 'Permit Issued — Zone B (Hot Work)',
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: { score: 35, level: 'caution', gas: 95, temp: 42, permits: 'Hot Work', workers: [] },
        C: { score: 27, level: 'normal', gas: 145, temp: 40, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:09', event: 'Worker entered Zone B',
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: {
          score: 61, level: 'warning', gas: 210, temp: 49, permits: 'Hot Work + Confined Space',
          workers: [{ id: 'Worker #07', status: 'Move to safe zone', accent: 'warning', exposure: '3 min' }],
        },
        C: { score: 30, level: 'caution', gas: 165, temp: 41, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:10', event: 'Zone B gas spike detected',
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: {
          score: 79, level: 'high', gas: 480, temp: 55, permits: 'Hot Work + Confined Space',
          workers: [
            { id: 'Worker #04', status: 'Exit immediately', accent: 'high', exposure: '9 min' },
            { id: 'Worker #07', status: 'Move to safe zone', accent: 'warning', exposure: '6 min' },
          ],
        },
        C: { score: 33, level: 'caution', gas: 172, temp: 41, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:10:30', event: 'Compound risk bonus triggered — Hot Work + Gas > 500 PPM',
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: {
          score: 88, level: 'critical', gas: 610, temp: 58, permits: 'Hot Work + Confined Space',
          workers: [
            { id: 'Worker #04', status: 'Exit immediately', accent: 'high', exposure: '11 min' },
            { id: 'Worker #07', status: 'Move to safe zone', accent: 'warning', exposure: '8 min' },
            { id: 'Worker #11', status: 'Entry blocked', accent: 'high', exposure: 'Entering' },
          ],
        },
        C: { score: 34, level: 'caution', gas: 174, temp: 41, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:11', event: 'ALERT TRIGGERED — Emergency Shutdown',
      zones: {
        A: { score: 16, level: 'caution', gas: 22, temp: 32, permits: 'None active', workers: [] },
        B: {
          score: 97, level: 'shutdown', gas: 847, temp: 63, permits: 'All permits suspended',
          workers: [
            { id: 'Worker #04', status: 'Exit immediately', accent: 'high', exposure: '14 min' },
            { id: 'Worker #07', status: 'Move to safe zone', accent: 'warning', exposure: '11 min' },
            { id: 'Worker #11', status: 'Entry blocked', accent: 'high', exposure: 'Entering' },
          ],
        },
        C: { score: 36, level: 'caution', gas: 176, temp: 41, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
      },
    },
  ];

  const tickCount = TICKS.length;
  const LEVEL_ORDER = ['normal', 'caution', 'warning', 'high', 'critical', 'shutdown'];
  const LEVEL_LABEL = {
    normal: 'Normal', caution: 'Caution', warning: 'Warning',
    high: 'High Risk', critical: 'Critical', shutdown: 'Emergency Shutdown',
  };

  function buildZoneData(tickIndex) {
    const tick = TICKS[tickIndex];
    const out = {};
    Object.keys(tick.zones).forEach((zid) => {
      const z = tick.zones[zid];
      out[zid] = {
        id: zid,
        name: `Zone ${zid}`,
        area: ZONE_AREA_NAME[zid],
        score: z.score,
        level: z.level,
        levelLabel: LEVEL_LABEL[z.level],
        coords: ZONE_COORDS[zid],
        sensorCoords: { lat: ZONE_COORDS[zid].lat + SENSOR_OFFSET.lat, lng: ZONE_COORDS[zid].lng + SENSOR_OFFSET.lng },
        note: z.level === 'normal' ? 'All parameters within safe limits.' : `${LEVEL_LABEL[z.level]} conditions — monitor zone.`,
        factors: factorsFor(z.gas, z.temp, z.permits),
        workers: z.workers,
      };
    });
    return out;
  }

  function highestRiskZoneId(zoneData) {
    let best = null;
    Object.values(zoneData).forEach((z) => {
      if (!best) { best = z; return; }
      const zRank = LEVEL_ORDER.indexOf(z.level);
      const bRank = LEVEL_ORDER.indexOf(best.level);
      if (zRank > bRank || (zRank === bRank && z.score > best.score)) best = z;
    });
    return best ? best.id : 'A';
  }

  const LEVEL_VAR = {
    normal: '--risk-normal', caution: '--risk-caution', warning: '--risk-warning',
    high: '--risk-high', critical: '--risk-critical', shutdown: '--risk-shutdown',
  };
  const LEVEL_TINT_VAR = {
    normal: '--risk-normal-tint', caution: '--risk-caution-tint', warning: '--risk-warning-tint',
    high: '--risk-high-tint', critical: '--risk-critical-tint', shutdown: '--risk-shutdown-tint',
  };
  const NOTIFY_THRESHOLD_RANK = LEVEL_ORDER.indexOf('high');

  // ---------- State ----------
  let mode = 'live';
  let liveTickIndex = tickCount - 1;
  let viewTickIndex = tickCount - 1;
  let pinnedZoneId = null;
  let isPlaying = false;
  let playTimer = null;
  const notifications = [];
  let lastNotifiedLevelByZone = {};

  let map, zoneLayers = {}, workerMarkers = [], sensorMarkers = [], zoneLabels = [];
  let defaultBounds = null; // computed once from ZONE_COORDS, used by both recenter's fitBounds and the visibility check// computed once from ZONE_COORDS, used by recenter + visibility check

  // ---------- Map init ----------
  function initMap() {
  map = L.map('mapSurface', { zoomControl: true, minZoom: 13, maxZoom: 19 });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);

  // Bounds that contain every zone's coordinate — the source of truth for
  // both the initial view and what "recenter" returns to.
  defaultBounds = L.latLngBounds(Object.values(ZONE_COORDS).map((c) => [c.lat, c.lng]));
map.fitBounds(defaultBounds, { padding: [50, 50] });
}

function recenterMap() {
  map.fitBounds(defaultBounds, { padding: [50, 50] });
}

  function colorFor(level) {
    return getComputedStyle(document.documentElement).getPropertyValue(LEVEL_VAR[level]).trim();
  }

  function renderMapLayer(zoneData) {
    Object.values(zoneLayers).forEach((l) => map.removeLayer(l));
    workerMarkers.forEach((m) => map.removeLayer(m));
    sensorMarkers.forEach((m) => map.removeLayer(m));
    zoneLabels.forEach((m) => map.removeLayer(m));
    zoneLayers = {}; workerMarkers = []; sensorMarkers = []; zoneLabels = [];

    Object.values(zoneData).forEach((zone) => {
      const accent = colorFor(zone.level);

      const circle = L.circle([zone.coords.lat, zone.coords.lng], {
        radius: 550,
        color: accent,
        weight: 2,
        fillColor: accent,
        fillOpacity: 0.22,
      }).addTo(map);
      circle.on('click', () => selectZone(zone.id));
      zoneLayers[zone.id] = circle;

      const label = L.marker([zone.coords.lat, zone.coords.lng], {
        icon: L.divIcon({
          className: '', html: `<div class="zone-label">${zone.name} · ${zone.area} · ${zone.levelLabel}</div>`,
          iconSize: null,
        }),
      }).addTo(map);
      label.on('click', () => selectZone(zone.id));
      zoneLabels.push(label);

      const sensor = L.marker([zone.sensorCoords.lat, zone.sensorCoords.lng], {
        icon: L.divIcon({
          className: '', html: `<div class="map-square" style="width:10px;height:10px;background:${accent};opacity:0.6"></div>`,
          iconSize: [10, 10],
        }),
      }).addTo(map);
      sensorMarkers.push(sensor);

      zone.workers.forEach((w, i) => {
        const wAccent = colorFor(w.accent);
        const angle = (i / Math.max(zone.workers.length, 1)) * Math.PI * 2;
        const wLat = zone.coords.lat + Math.cos(angle) * 0.0009;
        const wLng = zone.coords.lng + Math.sin(angle) * 0.0011;
        const worker = L.marker([wLat, wLng], {
          icon: L.divIcon({
            className: '', html: `<div class="map-dot" style="width:12px;height:12px;background:${wAccent}"></div>`,
            iconSize: [12, 12],
          }),
        }).addTo(map);
        worker.bindTooltip(`${w.id} — ${w.status}`, { direction: 'top' });
        workerMarkers.push(worker);
      });
    });
  }

  // ---------- Mode bar ----------
  function renderModeBar() {
    const bar = document.getElementById('modeBar');
    const label = document.getElementById('modeLabel');
    const tick = TICKS[viewTickIndex];

    if (mode === 'live') {
      bar.classList.remove('is-historical');
      label.innerHTML = `<span class="pill__dot"></span><span class="mode-bar__label--live">LIVE</span>`;
    } else {
      bar.classList.add('is-historical');
      label.innerHTML = `<span class="pill__dot"></span><span class="mode-bar__label--historical">HISTORICAL — ${tick.time}</span>`;
    }
  }

  function returnToLive() {
    stopPlay();
    mode = 'live';
    viewTickIndex = liveTickIndex;
    renderAll();
  }

  // ---------- Scrubber ----------
  function renderScrubber() {
    const track = document.getElementById('scrubberTrack');
    track.max = tickCount - 1;
    track.value = viewTickIndex;
    document.getElementById('scrubberTime').textContent = TICKS[viewTickIndex].time;
    document.getElementById('playBtn').textContent = isPlaying ? '❚❚' : '▶';
  }

  function enterHistoricalFromScrub(index) {
    stopPlay();
    mode = 'historical';
    viewTickIndex = index;
    renderAll();
  }

  function togglePlay() {
    if (isPlaying) { stopPlay(); return; }
    mode = 'historical';
    isPlaying = true;

    if (viewTickIndex >= tickCount - 1) {
      viewTickIndex = 0;
      notifications.length = 0;
      lastNotifiedLevelByZone = {};
    }

    renderAll();
    playTimer = setInterval(() => {
      viewTickIndex += 1;
      if (viewTickIndex >= tickCount - 1) {
        viewTickIndex = tickCount - 1;
        renderAll();
        stopPlay();
        return;
      }
      renderAll();
    }, 1500);
  }

  function stopPlay() {
    isPlaying = false;
    if (playTimer) clearInterval(playTimer);
    playTimer = null;
  }

  // ---------- Detail panel ----------
  function selectZone(zoneId) {
    stopPlay();
    pinnedZoneId = zoneId;
    dismissNotificationBannerFor(zoneId);
    renderDetailPanel();
  }

  function currentDisplayedZoneId(zoneData) {
    if (isPlaying) return highestRiskZoneId(zoneData);
    if (pinnedZoneId && zoneData[pinnedZoneId]) return pinnedZoneId;
    return highestRiskZoneId(zoneData);
  }

  function sortedZoneList(zoneData) {
    return Object.values(zoneData).sort((a, b) => {
      const rankA = LEVEL_ORDER.indexOf(a.level);
      const rankB = LEVEL_ORDER.indexOf(b.level);
      if (rankB !== rankA) return rankB - rankA;
      return b.score - a.score;
    });
  }

  function renderDetailPanel() {
    const zoneData = buildZoneData(viewTickIndex);
    const zones = sortedZoneList(zoneData);
    const selectedId = currentDisplayedZoneId(zoneData);

    document.getElementById('detailSubtitle').textContent = 'All zones · Most critical on top';

    const cardsHtml = zones.map((zone) => {
      const accent = `var(${LEVEL_VAR[zone.level]})`;
      const isSelected = zone.id === selectedId;

      const factorsHtml = zone.factors
        .map((f) => `<div class="factor-row"><span>${f.label}</span><span>${f.value}</span></div>`)
        .join('');

      const workersHtml = zone.workers.length
        ? zone.workers.map((w) => `
            <div class="worker-mini-row">
              <span class="worker-mini-row__id">${w.id}</span>
              <span class="pill" style="--pill-bg: var(${LEVEL_TINT_VAR[w.accent]}); --pill-fg: var(${LEVEL_VAR[w.accent]});">${w.status}</span>
            </div>`).join('')
        : `<p style="font-size:12px;color:var(--text-muted)">No workers currently in this zone.</p>`;

      return `
        <div class="zone-detail-card ${isSelected ? 'is-selected' : ''}" data-zone="${zone.id}" style="--card-accent:${accent}">
          <div class="zone-card__expanded-header" style="margin-bottom:14px;">
            <h3 style="font-size:16px;">${zone.name} · ${zone.area}</h3>
            <span class="pill" style="--pill-bg: var(${LEVEL_TINT_VAR[zone.level]}); --pill-fg: var(${LEVEL_VAR[zone.level]});">
              <span class="pill__dot"></span>${zone.levelLabel} · ${zone.score}
            </span>
          </div>
          <div class="zone-card__section-title" style="margin-top:0;">${zone.level === 'normal' ? 'Current conditions' : "Why it's alerting"}</div>
          ${factorsHtml}
          <div class="expanded-divider"></div>
          <div class="zone-card__section-title">${zone.level === 'normal' ? 'Workers in zone' : "Who's at risk"}</div>
          ${workersHtml}
        </div>
      `;
    }).join('');

    document.getElementById('detailPanelBody').innerHTML = `<div class="zone-detail-list">${cardsHtml}</div>`;

    document.querySelectorAll('.zone-detail-card').forEach((card) => {
      card.addEventListener('click', () => selectZone(card.dataset.zone));
    });
  }

  // ---------- Notifications ----------
  function checkForNewNotifications(zoneData) {
    Object.values(zoneData).forEach((zone) => {
      const rank = LEVEL_ORDER.indexOf(zone.level);
      const prevLevel = lastNotifiedLevelByZone[zone.id];
      const prevRank = prevLevel ? LEVEL_ORDER.indexOf(prevLevel) : -1;
      if (rank >= NOTIFY_THRESHOLD_RANK && rank > prevRank) {
        notifications.unshift({
          id: `${zone.id}-${viewTickIndex}-${zone.level}`,
          time: TICKS[viewTickIndex].time,
          zoneId: zone.id,
          level: zone.level,
          text: `${zone.name} is now ${zone.levelLabel}.`,
          read: false,
        });
      }
      lastNotifiedLevelByZone[zone.id] = zone.level;
    });
  }

  function dismissNotificationBannerFor(zoneId) {
    notifications.forEach((n) => { if (n.zoneId === zoneId) n.read = true; });
  }

  function renderNotifications() {
    const panel = document.getElementById('notifPanel');
    const collapsedText = document.getElementById('notifCollapsedText');
    const list = document.getElementById('notifList');

    if (!notifications.length) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';

    const latest = notifications[0];
    const collapsedEl = document.getElementById('notifCollapsedOpen');
    collapsedEl.style.setProperty('--pill-bg', `var(${LEVEL_TINT_VAR[latest.level]})`);
    collapsedEl.style.setProperty('--pill-fg', `var(${LEVEL_VAR[latest.level]})`);
    collapsedText.innerHTML = `<span class="pill__dot"></span>${latest.text}`;

    list.innerHTML = notifications.map((n) => `
      <div class="notif-row ${n.read ? 'is-read' : ''}" data-zone="${n.zoneId}"
           style="--pill-bg: var(${LEVEL_TINT_VAR[n.level]}); --pill-fg: var(${LEVEL_VAR[n.level]});">
        <span class="notif-row__time">${n.time}</span>
        <span class="notif-row__text">${n.text}</span>
      </div>
    `).join('');

    list.querySelectorAll('.notif-row').forEach((row) => {
      row.addEventListener('click', () => {
        selectZone(row.dataset.zone);
        document.getElementById('notifPanel').classList.remove('is-open');
      });
    });
  }

  function wireNotifPanel() {
    const panel = document.getElementById('notifPanel');
    document.getElementById('notifCollapsedOpen').addEventListener('click', () => panel.classList.add('is-open'));
    document.getElementById('notifClose').addEventListener('click', () => panel.classList.remove('is-open'));
  }

  // ---------- Central render ----------
  function renderAll() {
    const zoneData = buildZoneData(viewTickIndex);
    checkForNewNotifications(zoneData);
    renderMapLayer(zoneData);
    renderModeBar();
    renderScrubber();
    renderDetailPanel();
    renderNotifications();
  }

  // ---------- Wire controls ----------
  function wireControls() {
    document.getElementById('returnLiveBtn').addEventListener('click', returnToLive);
    document.getElementById('scrubberTrack').addEventListener('input', (e) => {
      enterHistoricalFromScrub(parseInt(e.target.value, 10));
    });
    document.getElementById('playBtn').addEventListener('click', togglePlay);
    document.getElementById('recenterBtn').addEventListener('click', recenterMap);
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    wireControls();
    wireNotifPanel();
    renderAll();
  });
})();