/* ==========================================================================
   SENTINEL — alerts.js (v2)
   Renders the Alert Panel (4 zone cards, pill badges) + the soft floor-plan
   heatmap teaser on index.html. Placeholder data — Day 4-7 wires to /api/risk.
   ========================================================================== */

(function () {
  'use strict';

  const ZONES = [
    {
      id: 'A', name: 'Zone A', score: 22, level: 'normal', levelLabel: 'Normal',
      note: 'All parameters within safe limits.',
      factors: [
        { label: 'Gas', value: '20 PPM' }, { label: 'Temperature', value: '32°C' },
        { label: 'Permits', value: 'None active' }, { label: 'Workers', value: '1' },
      ],
      workers: [],
    },
    {
      id: 'B', name: 'Zone B', score: 78, level: 'high', levelLabel: 'High Risk',
      note: 'Dangerous compound conditions detected.',
      factors: [
        { label: 'Gas', value: '520 PPM' }, { label: 'Temperature', value: '58°C' },
        { label: 'Permits', value: 'Hot Work + Confined Space' }, { label: 'Compound bonus', value: '+20' },
      ],
      workers: [
        { id: 'Worker #04', status: 'Exit immediately', accent: 'high' },
        { id: 'Worker #07', status: 'Move to safe zone', accent: 'warning' },
        { id: 'Worker #11', status: 'Entry blocked', accent: 'high' },
      ],
    },
    {
      id: 'C', name: 'Zone C', score: 46, level: 'caution', levelLabel: 'Caution',
      note: 'Conditions changing. Monitor closely.',
      factors: [
        { label: 'Gas', value: '180 PPM' }, { label: 'Temperature', value: '41°C' },
        { label: 'Permits', value: 'Electrical' }, { label: 'Workers', value: '2' },
      ],
      workers: [],
    },
    {
      id: 'D', name: 'Zone D', score: 15, level: 'normal', levelLabel: 'Normal',
      note: 'All parameters within safe limits.',
      factors: [
        { label: 'Gas', value: '12 PPM' }, { label: 'Temperature', value: '29°C' },
        { label: 'Permits', value: 'None active' }, { label: 'Workers', value: '0' },
      ],
      workers: [],
    },
    {
      id: 'E', name: 'Zone E', score: 18, level: 'normal', levelLabel: 'Normal',
      note: 'All parameters within safe limits.',
      factors: [
        { label: 'Gas', value: '11 PPM' }, { label: 'Temperature', value: '29°C' },
        { label: 'Permits', value: 'None active' }, { label: 'Workers', value: '0' },
      ],
      workers: [],
    },
    {
      id: 'F', name: 'Zone F', score: 14, level: 'normal', levelLabel: 'Normal',
      note: 'All parameters within safe limits.',
        factors: [
          { label: 'Gas', value: '9 PPM' }, { label: 'Temperature', value: '27°C' },
          { label: 'Permits', value: 'None active' }, { label: 'Workers', value: '0' },
      ],
      workers: [],
    },
  ];

  const LEVEL_VAR = {
    normal: '--risk-normal', caution: '--risk-caution', warning: '--risk-warning',
    high: '--risk-high', critical: '--risk-critical', shutdown: '--risk-shutdown',
  };
  const LEVEL_TINT_VAR = {
    normal: '--risk-normal-tint', caution: '--risk-caution-tint', warning: '--risk-warning-tint',
    high: '--risk-high-tint', critical: '--risk-critical-tint', shutdown: '--risk-shutdown-tint',
  };

  function pillStyle(level) {
    return `--pill-bg: var(${LEVEL_TINT_VAR[level]}); --pill-fg: var(${LEVEL_VAR[level]});`;
  }

  function render() {
    const grid = document.getElementById('alertGrid');
    if (!grid) return;
    grid.innerHTML = ZONES.map(cardTemplate).join('');
    window.SentinelExpand.attach('#alertGrid', '.zone-card');
    renderFloorplan();
  }

  function cardTemplate(zone) {
    const isQuiet = zone.level === 'normal';
    const accentVar = `var(${LEVEL_VAR[zone.level]})`;
    const factorsHtml = zone.factors
      .map((f) => `<div class="factor-row"><span>${f.label}</span><span>${f.value}</span></div>`).join('');
    const workersHtml = zone.workers.length
      ? zone.workers.map((w) => `
          <div class="worker-mini-row">
            <span class="worker-mini-row__id">${w.id}</span>
            <span class="pill" style="${pillStyle(w.accent)}">${w.status}</span>
          </div>`).join('')
      : `<p style="font-size:12px;color:var(--text-muted)">${isQuiet ? 'No workers currently assigned to this zone.' : 'No workers currently in this zone.'}</p>`;

    // Section labels adapt to zone state — a Normal zone has nothing "alerting"
    // about it, so the framing shouldn't imply danger where there is none.
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

  function renderFloorplan() {
    const el = document.getElementById('heatmapTeaserPreview');
    if (!el) return;
    el.innerHTML = ZONES.map((zone) => `
      <div class="floorplan__room"
           style="--room-bg: var(${LEVEL_TINT_VAR[zone.level]}); --room-fg: var(${LEVEL_VAR[zone.level]});"
           title="${zone.name} — ${zone.levelLabel}">
        <div class="floorplan__room-zone">${zone.name}</div>
        <div class="floorplan__room-status">${zone.levelLabel} · ${zone.score}</div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', render);
})();