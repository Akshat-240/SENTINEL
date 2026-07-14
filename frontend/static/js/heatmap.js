/* ==========================================================================
   SENTINEL — heatmap.js
   Leaflet map (CartoDB Voyager) + zone polygons + worker/sensor markers +
   Live/Historical/Play modes + detail panel + top-right notification panel.
   Data (TICKS, ZONE_COORDS, etc.) lives in data.js — this file is
   rendering/interaction logic only.
   ========================================================================== */

(function () {
  'use strict';

  const { ZONE_COORDS, ZONE_AREA_NAME, LEVEL_ORDER, LEVEL_LABEL, LEVEL_VAR, LEVEL_TINT_VAR } = window.SENTINEL_DATA;

  const SENSOR_OFFSET = { lat: 0.0015, lng: 0.0018 };

  function factorsFor(gas, temp, permits) {
    return [
      { label: 'Gas', value: `${gas} PPM` },
      { label: 'Temperature', value: `${temp}°C` },
      { label: 'Permits', value: permits },
    ];
  }

  function getTickCount() { return window.SENTINEL_DATA.tickCount; }

  function createDummyZoneData() {
    const out = {};
    Object.keys(ZONE_COORDS).forEach(zid => {
      out[zid] = {
        id: zid, name: `Zone ${zid}`, area: ZONE_AREA_NAME[zid],
        score: 0, level: 'normal', levelLabel: 'Normal',
        coords: ZONE_COORDS[zid], sensorCoords: { lat: ZONE_COORDS[zid].lat + SENSOR_OFFSET.lat, lng: ZONE_COORDS[zid].lng + SENSOR_OFFSET.lng },
        note: '', factors: [], workers: []
      }
    });
    return out;
  }

  function buildZoneData(tickIndex) {
    if (mode === 'live') {
      const liveData = window.SENTINEL_DATA.getLiveState();
      const out = {};
      Object.keys(liveData).forEach((zid) => {
        const z = liveData[zid];
        out[zid] = {
          id: zid,
          name: `Zone ${zid}`,
          area: ZONE_AREA_NAME[zid],
          score: z.score,
          level: z.level,
          levelLabel: z.levelLabel || LEVEL_LABEL[z.level],
          coords: ZONE_COORDS[zid],
          sensorCoords: { lat: ZONE_COORDS[zid].lat + SENSOR_OFFSET.lat, lng: ZONE_COORDS[zid].lng + SENSOR_OFFSET.lng },
          note: z.note || (z.level === 'normal' ? 'All parameters within safe limits.' : `${LEVEL_LABEL[z.level]} conditions — monitor zone.`),
          factors: factorsFor(z.gas, z.temp, z.permits),
          workers: z.workers || [],
        };
      });
      if (Object.keys(out).length === 0) return createDummyZoneData();
      return out;
    } else {
      const tick = window.SENTINEL_DATA.getTickByIndex(tickIndex);
      if (!tick || !tick.zones) return createDummyZoneData();
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
          workers: z.workers || [],
        };
      });
      return out;
    }
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

  const NOTIFY_THRESHOLD_RANK = LEVEL_ORDER.indexOf('high');

  // ---------- State ----------
  let mode = 'live';
  let viewTickIndex = 0;
  let pinnedZoneId = null;
  let isPlaying = false;
  let playTimer = null;
  const notifications = [];
  let lastNotifiedLevelByZone = {};

  let map, zoneLayers = {}, workerMarkers = [], sensorMarkers = [], zoneLabels = [];
  let defaultBounds = null; // computed once from ZONE_COORDS, used by both recenter's fitBounds and the visibility check

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
    const tick = window.SENTINEL_DATA.getTickByIndex(viewTickIndex) || {time: '00:00'};

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
    viewTickIndex = Math.max(0, getTickCount() - 1);
    renderAll();
  }

  // ---------- Scrubber ----------
  function renderScrubber() {
    const track = document.getElementById('scrubberTrack');
    track.max = Math.max(0, getTickCount() - 1);
    track.value = viewTickIndex;
    const tick = window.SENTINEL_DATA.getTickByIndex(viewTickIndex);
    document.getElementById('scrubberTime').textContent = tick ? tick.time : '00:00';
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

    if (viewTickIndex >= getTickCount() - 1) {
      viewTickIndex = 0;
      notifications.length = 0;
      lastNotifiedLevelByZone = {};
    }

    renderAll();
    playTimer = setInterval(() => {
      viewTickIndex += 1;
      if (viewTickIndex >= getTickCount() - 1) {
        viewTickIndex = getTickCount() - 1;
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

  // ---------- Global Replay Mode integration ----------
  // On load, if the app is globally in Replay Mode, jump straight to that
  // timestamp instead of Live. Also listens for changes fired by
  // SentinelReplay.enter()/resumeLive() from anywhere (common.js).
  function syncWithGlobalReplayState() {
    const state = window.SentinelReplay ? window.SentinelReplay.getState() : { mode: 'live' };
    stopPlay();
    if (state.mode === 'replay') {
      mode = 'historical';
      viewTickIndex = window.SENTINEL_DATA.getTickIndexForTimestamp(state.timestamp);
    } else {
      mode = 'live';
      viewTickIndex = Math.max(0, getTickCount() - 1);
    }
    renderAll();
  }

  document.addEventListener('sentinel:replay-changed', syncWithGlobalReplayState);

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
        <div class="zone-detail-card ${isSelected ? 'is-selected' : ''}" data-zone="${zone.id}" style="--card-accent:${accent}" tabindex="0" role="button" aria-pressed="${isSelected}">
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
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectZone(card.dataset.zone);
        }
      });
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
          id: `${zone.id}-${viewTickIndex}-${zone.level}-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
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
    syncWithGlobalReplayState();
    
    // Auto-refresh when data.js fires event
    document.addEventListener('sentinel:data-updated', (e) => {
        if (mode === 'live') {
            viewTickIndex = Math.max(0, getTickCount() - 1); // keep timeline scrub at end
            renderAll();
        } else if (e.detail.type === 'historical') {
            // refresh scrubber bounds
            renderScrubber();
        }
    });
  });
})();