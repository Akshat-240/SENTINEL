/* ==========================================================================
   SENTINEL — alerts.js (ASCII Dashboard)
   ========================================================================== */

(function () {
  'use strict';

  function render() {
    const liveData = window.SENTINEL_DATA.getLiveState();
    const zones = Object.values(liveData).sort((a, b) => b.score - a.score);
    if (zones.length === 0) return;

    // 1. Plant Overview
    const overviewEl = document.getElementById('plantOverview');
    if (overviewEl) {
      const rows = zones.map(z => {
        let icon = '🟢';
        let colorClass = 'color-normal';
        if (z.score >= 75) { icon = '🔴'; colorClass = 'color-critical'; }
        else if (z.score >= 50) { icon = '🟠'; colorClass = 'color-warning'; }
        else if (z.score >= 30) { icon = '🟡'; colorClass = 'color-caution'; }
        
        // Find area name
        const areaName = window.SENTINEL_DATA.ZONE_AREA_NAME[z.raw.zone_id.toUpperCase().replace('ZONE_', '')] || z.raw.zone_id;
        
        return `<div class="zone-row">
          <div>${icon} ${z.raw.zone_id.toUpperCase().padEnd(8, ' ')} ${areaName.padEnd(25, ' ')}</div>
          <div class="${colorClass}">Risk: ${z.score}</div>
        </div>`;
      }).join('');
      overviewEl.innerHTML = rows;
      overviewEl.classList.remove('loading-overlay');
    }

    // 2. Last Updated
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) {
      const now = new Date();
      lastUpdatedEl.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }

    // 3. Active Alerts
    const alertsEl = document.getElementById('activeAlerts');
    if (alertsEl) {
      const activeAlerts = zones.filter(z => z.score >= 50);
      if (activeAlerts.length === 0) {
        alertsEl.innerHTML = '<div style="color:var(--text-muted)">No active alerts.</div>';
      } else {
        const rows = activeAlerts.map(z => {
          return `<div style="margin-bottom:12px;">
            <div style="font-weight:600; color:var(--risk-high)">[ALERT] ${z.raw.zone_id.toUpperCase()}</div>
            <div style="color:var(--text-secondary)">${z.note}</div>
          </div>`;
        }).join('');
        alertsEl.innerHTML = rows;
      }
      alertsEl.classList.remove('loading-overlay');
    }

    // 4. Compound Risks
    const compoundEl = document.getElementById('compoundRisks');
    if (compoundEl) {
      const compoundRiskZones = zones.filter(z => z.raw.combinations_detected && z.raw.combinations_detected.length > 0);
      if (compoundRiskZones.length === 0) {
        compoundEl.innerHTML = '<div style="color:var(--text-muted)">No compound risks detected.</div>';
      } else {
        const rows = compoundRiskZones.map(z => {
          return `<div style="margin-bottom:12px;">
            <div style="font-weight:600; color:var(--risk-warning)">[COMPOUND] ${z.raw.zone_id.toUpperCase()}</div>
            <div style="color:var(--text-secondary)">${z.raw.combinations_detected.join(' + ')}</div>
          </div>`;
        }).join('');
        compoundEl.innerHTML = rows;
      }
      compoundEl.classList.remove('loading-overlay');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
      document.addEventListener('sentinel:data-updated', (e) => {
          if (e.detail.type === 'live') render();
      });
  });
})();