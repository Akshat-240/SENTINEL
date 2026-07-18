/* ==========================================================================
   SENTINEL — workers.js
   ========================================================================== */

(function () {
  'use strict';

  function renderWorkers() {
    const liveData = window.SENTINEL_DATA.getLiveState();
    const zones = Object.values(liveData);
    if (zones.length === 0) return;

    const workersEl = document.getElementById('workersList');
    if (!workersEl) return;

    // Aggregate all workers from all zones
    let allWorkers = [];
    zones.forEach(z => {
      if (z.raw.snapshot.workers && z.raw.snapshot.workers.length > 0) {
        z.raw.snapshot.workers.forEach(w => {
          const shortId = z.raw.zone_id.toUpperCase().replace('ZONE_', '');
          const areaName = window.SENTINEL_DATA.ZONE_AREA_NAME[shortId] || z.raw.zone_id;
          allWorkers.push({
            id: w.worker_id,
            zone: `${z.raw.zone_id.toUpperCase()} (${areaName})`,
            time: w.entry_time,
            score: z.score
          });
        });
      }
    });

    // Sort by risk exposure
    allWorkers.sort((a, b) => b.score - a.score);

    if (allWorkers.length === 0) {
      workersEl.innerHTML = '<div style="color:var(--text-muted)">No workers active in tracked zones.</div>';
      workersEl.classList.remove('loading-overlay');
      return;
    }

    const html = allWorkers.map(w => {
      let colorClass = 'color-normal';
      let action = 'ROUTINE MONITORING';
      
      if (w.score >= 75) { colorClass = 'color-critical'; action = 'EVACUATE IMMEDIATELY'; }
      else if (w.score >= 50) { colorClass = 'color-warning'; action = 'MOVE TO SAFE ZONE'; }
      else if (w.score >= 30) { colorClass = 'color-caution'; action = 'HIGH VIGILANCE'; }
      
      return `
        <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-family:var(--font-mono); font-size:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
          <div style="flex:1; font-weight:600;">WORKER ${w.id}</div>
          <div style="flex:1; color:var(--text-secondary)">LOC: ${w.zone}</div>
          <div style="flex:1; text-align:right;" class="${colorClass}">${action} (Risk: ${w.score})</div>
        </div>
      `;
    }).join('');

    workersEl.innerHTML = html;
    workersEl.classList.remove('loading-overlay');
  }

  document.addEventListener('DOMContentLoaded', () => {
      document.addEventListener('sentinel:data-updated', (e) => {
          if (e.detail.type === 'live') renderWorkers();
      });
  });
})();