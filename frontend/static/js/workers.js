/* ==========================================================================
   SENTINEL — workers.js (v2)
   Worker Exposure Panel for index.html: filtered to at-risk workers only,
   sorted by urgency, rendered as clean rows with pill status badges.
   Placeholder data — Day 4-7 wires to /api/workers.
   ========================================================================== */

(function () {
  'use strict';

  const URGENCY_ORDER = ['Exit immediately', 'Entry blocked', 'Move to safe zone'];

  const WORKERS = [
    { id: 'Worker #04', zone: 'Zone B', exposure: '14 min', status: 'Exit immediately', accent: 'high' },
    { id: 'Worker #11', zone: 'Zone B', exposure: 'Entering', status: 'Entry blocked', accent: 'high' },
    { id: 'Worker #07', zone: 'Zone B', exposure: '3 min', status: 'Move to safe zone', accent: 'warning' },
    { id: 'Worker #02', zone: 'Zone C', exposure: '6 min', status: 'Move to safe zone', accent: 'warning' },
  ];

  const LEVEL_VAR = { warning: '--risk-warning', high: '--risk-high', critical: '--risk-critical' };
  const LEVEL_TINT_VAR = { warning: '--risk-warning-tint', high: '--risk-high-tint', critical: '--risk-critical-tint' };

  function render() {
    const panel = document.getElementById('workerList');
    if (!panel) return;

    if (!WORKERS.length) {
      panel.innerHTML = `
        <div class="worker-panel__empty">
          <div class="worker-panel__empty-dot"></div>
          All workers currently in safe zones.
        </div>`;
      return;
    }

    const sorted = [...WORKERS].sort(
      (a, b) => URGENCY_ORDER.indexOf(a.status) - URGENCY_ORDER.indexOf(b.status)
    );

    panel.innerHTML = sorted.map((w) => `
      <div class="worker-row">
        <div>
          <div class="worker-row__id">${w.id}</div>
          <div class="worker-row__meta">${w.zone}</div>
        </div>
        <div class="worker-row__right">
          <div class="worker-row__exposure">${w.exposure}</div>
          <span class="pill" style="--pill-bg: var(${LEVEL_TINT_VAR[w.accent]}); --pill-fg: var(${LEVEL_VAR[w.accent]});">${w.status}</span>
        </div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', render);
})();