/* ==========================================================================
   SENTINEL — permits.js
   ========================================================================== */

(function () {
  'use strict';

  async function fetchPermits() {
    const permitsEl = document.getElementById('permitsList');
    const countEl = document.getElementById('permitCount');
    if (!permitsEl) return;

    try {
      // 1. Fetch all zones
      const zonesRes = await fetch('http://localhost:5000/api/dashboard/zones');
      if (!zonesRes.ok) throw new Error('Failed to fetch zones');
      const zonesData = await zonesRes.json();
      
      let allPermits = [];
      
      // 2. Fetch permits for each zone
      for (const zone of zonesData) {
        // zone_id from config/zones.json is lowercase, but database permits table has uppercase ZONE_A
        const zoneId = zone.zone_id.toUpperCase();
        const permitRes = await fetch(`http://localhost:5000/api/permits/active/${zoneId}`);
        if (permitRes.ok) {
          const permits = await permitRes.json();
          allPermits = allPermits.concat(permits);
        }
      }
      
      // 5. Show total count in header
      if (countEl) {
          countEl.innerText = `Total Permits: ${allPermits.length}`;
      }

      // 3. Display each permit
      if (allPermits.length === 0) {
        permitsEl.innerHTML = '<div style="color:var(--text-muted)">No active permits detected.</div>';
        permitsEl.classList.remove('loading-overlay');
        return;
      }
      
      let html = '';
      allPermits.forEach(p => {
        // 4. Color code by type
        let colorClass = 'color-normal'; // GENERAL -> green
        const pType = (p.type || '').toUpperCase();
        
        if (pType.includes('HOT_WORK') || pType.includes('HOT WORK')) {
            colorClass = 'color-high'; // red
        } else if (pType.includes('CONFINED_SPACE') || pType.includes('CONFINED')) {
            colorClass = 'color-warning'; // orange
        } else if (pType.includes('ELECTRICAL')) {
            colorClass = 'color-caution'; // yellow
        }

        let shortId = p.zone_id.toUpperCase().replace('ZONE_', '');
        let areaName = window.SENTINEL_DATA && window.SENTINEL_DATA.ZONE_AREA_NAME ? window.SENTINEL_DATA.ZONE_AREA_NAME[shortId] || p.zone_id : p.zone_id;
        
        html += `
          <div style="margin-bottom:12px; font-family:var(--font-mono); font-size:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
            <div style="display:flex; justify-content:space-between;">
              <span class="${colorClass}" style="font-weight:600;">[${p.permit_id}] ${p.type}</span>
              <span style="color:var(--text-secondary)">Zone: ${p.zone_id.toUpperCase()} (${areaName})</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:4px;">
              <span>Worker: ${p.worker_id}</span>
              <span>Status: ${p.status}</span>
            </div>
          </div>
        `;
      });
      
      permitsEl.innerHTML = html;
      permitsEl.classList.remove('loading-overlay');
      
    } catch (err) {
      console.error(err);
      permitsEl.innerHTML = `<span class="color-critical">Failed to load permits: ${err.message}</span>`;
      permitsEl.classList.remove('loading-overlay');
    }
  }

  document.addEventListener('DOMContentLoaded', fetchPermits);
})();