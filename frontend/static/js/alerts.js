/* ==========================================================================
   SENTINEL — alerts.js (v2)
   Renders the Alert Panel (4 zone cards, pill badges) + the soft floor-plan
   heatmap teaser on index.html. Wires to /api/risk (via data.js).
   ========================================================================== */

(function () {
  'use strict';

  const LEVEL_VAR = window.SENTINEL_DATA.LEVEL_VAR;
  const LEVEL_TINT_VAR = window.SENTINEL_DATA.LEVEL_TINT_VAR;

  function pillStyle(level) {
    return `--pill-bg: var(${LEVEL_TINT_VAR[level]}); --pill-fg: var(${LEVEL_VAR[level]});`;
  }

  function render() {
    const grid = document.getElementById('alertGrid');
    if (!grid) return;
    
    const liveData = window.SENTINEL_DATA.getLiveState();
    const zones = Object.values(liveData).sort((a, b) => b.score - a.score);
    
    if (zones.length === 0) return; // Wait for initial fetch
    
    // Only show top 4 most critical zones in the teaser grid
    grid.innerHTML = zones.slice(0, 4).map(cardTemplate).join('');
    window.SentinelExpand.attach('#alertGrid', '.zone-card');
    renderFloorplan(zones);
  }

  function factorList(zone) {
      return [
        { label: 'Gas', value: `${zone.gas} PPM` }, 
        { label: 'Temperature', value: `${zone.temp}°C` },
        { label: 'Permits', value: zone.permits }, 
        { label: 'Workers', value: zone.workers.length }
      ];
  }

  function cardTemplate(zone) {
    const isQuiet = zone.level === 'normal';
    const accentVar = `var(${LEVEL_VAR[zone.level]})`;
    
    const factorsHtml = factorList(zone)
      .map((f) => `<div class="factor-row"><span>${f.label}</span><span>${f.value}</span></div>`).join('');
      
    const workersHtml = zone.workers.length
      ? zone.workers.map((w) => `
          <div class="worker-mini-row">
            <span class="worker-mini-row__id">${w.id}</span>
            <span class="pill" style="${pillStyle(w.accent)}">${w.status}</span>
          </div>`).join('')
      : `<p style="font-size:12px;color:var(--text-muted)">${isQuiet ? 'No workers currently assigned to this zone.' : 'No workers currently in this zone.'}</p>`;

    const factorsTitle = isQuiet ? 'Current conditions' : "Why it's alerting";
    const workersTitle = isQuiet ? 'Workers in zone' : "Who's at risk";

    return `
      <div class="zone-card ${isQuiet ? 'is-quiet' : 'is-elevated'}" style="--card-accent: ${accentVar}" data-zone="${zone.id}">
        <div class="zone-card__collapsed">
          <span class="zone-card__zone">${zone.name}</span>
          <div class="zone-card__score">${zone.score}</div>
          <span class="pill" style="${pillStyle(zone.level)}">
            <span class="pill__dot"></span>${zone.levelLabel}
          </span>
          <div class="zone-card__note">${zone.note}</div>
        </div>
        <div class="zone-card__expanded">
          <div class="zone-card__expanded-header">
            <h3 style="font-size:16px;">${zone.name}</h3>
            <span class="pill" style="${pillStyle(zone.level)}">${zone.levelLabel}</span>
            <span class="zone-card__close">Close</span>
          </div>
          <div class="zone-card__section-title">${factorsTitle}</div>
          ${factorsHtml}
          <div class="expanded-divider"></div>
          <div class="zone-card__section-title">${workersTitle}</div>
          ${workersHtml}
        </div>
      </div>
    `;
  }

  function renderFloorplan(zones) {
    const el = document.getElementById('heatmapTeaserPreview');
    if (!el) return;
    el.innerHTML = zones.map((zone) => `
      <div class="floorplan__room"
           style="--room-bg: var(${LEVEL_TINT_VAR[zone.level]}); --room-fg: var(${LEVEL_VAR[zone.level]});"
           title="${zone.name} — ${zone.levelLabel}">
        <div class="floorplan__room-zone">${zone.name}</div>
        <div class="floorplan__room-status">${zone.levelLabel} · ${zone.score}</div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
      render();
      document.addEventListener('sentinel:data-updated', (e) => {
          if (e.detail.type === 'live') render();
      });
  });
})();