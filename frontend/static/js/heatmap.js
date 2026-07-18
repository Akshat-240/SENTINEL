/* ==========================================================================
   SENTINEL — heatmap.js (ASCII Floorplan & Disaster DNA)
   ========================================================================== */

(function () {
  'use strict';

  function renderFloorplan() {
    const liveData = window.SENTINEL_DATA.getLiveState();
    const zones = Object.values(liveData);
    if (zones.length === 0) return;

    const floorplanEl = document.getElementById('heatmapFloorplan');
    if (!floorplanEl) return;

    // We'll create a simple CSS grid layout for the "floorplan"
    floorplanEl.style.display = 'grid';
    floorplanEl.style.gridTemplateColumns = '1fr 1fr';
    floorplanEl.style.gridTemplateRows = '1fr 1fr 1fr';
    floorplanEl.style.gap = '8px';
    floorplanEl.style.padding = '8px';
    floorplanEl.classList.remove('loading-overlay');

    const html = zones.map(z => {
      let colorClass = 'color-normal';
      if (z.score >= 75) colorClass = 'color-critical';
      else if (z.score >= 50) colorClass = 'color-warning';
      else if (z.score >= 30) colorClass = 'color-caution';
      
      const areaName = window.SENTINEL_DATA.ZONE_AREA_NAME[z.raw.zone_id.toUpperCase().replace('ZONE_', '')] || z.raw.zone_id;
      
      return `
        <div class="heatmap-zone" 
             style="border: 1px solid var(--border-strong); border-radius:4px; padding: 12px; cursor: pointer; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;"
             data-zone-id="${z.raw.zone_id}">
          <div style="font-weight:600; margin-bottom:8px;">${z.raw.zone_id.toUpperCase()}</div>
          <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">${areaName}</div>
          <div class="${colorClass}" style="font-size:18px; font-weight:700;">Score: ${z.score}</div>
        </div>
      `;
    }).join('');

    floorplanEl.innerHTML = html;

    // Attach click events
    document.querySelectorAll('.heatmap-zone').forEach(el => {
      el.addEventListener('click', (e) => {
        const zoneId = e.currentTarget.getAttribute('data-zone-id');
        fetchDisasterDNA(zoneId);
        
        // highlight selection
        document.querySelectorAll('.heatmap-zone').forEach(z => z.style.borderColor = 'var(--border-strong)');
        e.currentTarget.style.borderColor = 'var(--text)';
      });
    });
  }

  async function fetchDisasterDNA(zoneId) {
    const dnaEl = document.getElementById('disasterDna');
    if (!dnaEl) return;

    dnaEl.innerHTML = '<div class="loading-overlay" style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;"><div class="spinner"></div><div style="margin-top:16px;">Fetching similarity analysis...</div></div>';
    if (dnaEl.parentElement) {
        dnaEl.parentElement.style.borderColor = 'var(--border)';
    }

    try {
        const res = await fetch(`http://localhost:5000/api/risk/similarity/${zoneId}`);
        if (!res.ok) throw new Error('Failed to fetch similarity');
        const data = await res.json();
        
        const shortId = zoneId.toUpperCase().replace('ZONE_', '');
        let areaName = 'Unknown Zone';
        if (window.SENTINEL_DATA && window.SENTINEL_DATA.ZONE_AREA_NAME) {
            areaName = window.SENTINEL_DATA.ZONE_AREA_NAME[shortId] || zoneId;
        }

        if (dnaEl.parentElement) {
            if (data.highest_similarity > 70) {
                dnaEl.parentElement.style.borderColor = 'var(--risk-critical)';
            } else if (data.highest_similarity > 40) {
                dnaEl.parentElement.style.borderColor = 'var(--risk-warning)';
            }
        }

        let barsHtml = '';
        if (data.all_scores && data.all_scores.length > 0) {
            data.all_scores.forEach(score => {
                const sim = score.similarity;
                const barLength = Math.max(1, Math.floor(sim / 5));
                const barStr = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
                let colorClass = 'color-normal';
                if (sim > 70) colorClass = 'color-critical';
                else if (sim > 40) colorClass = 'color-warning';
                
                barsHtml += `
                  <div style="margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                      <span>${score.name}</span>
                      <span class="${colorClass}">${sim.toFixed(1)}%</span>
                    </div>
                    <div class="${colorClass}" style="font-family:var(--font-mono); font-size:12px; letter-spacing:2px;">
                      [${barStr}]
                    </div>
                  </div>
                `;
            });
        } else {
            barsHtml = '<div style="color:var(--text-muted)">No profile matches found.</div>';
        }

        const highestMatchText = data.highest_similarity ? data.highest_similarity.toFixed(1) : '0.0';
        const matchedProfileText = data.matched_profile || 'None';
        const hoursText = data.intervention_window_hours !== null && data.intervention_window_hours !== undefined ? data.intervention_window_hours : 'N/A';

        const html = `
          <div style="font-family:var(--font-mono); font-size:14px; line-height:1.6;">
            <div style="font-size:16px; font-weight:700; margin-bottom:16px; color:var(--text); border-bottom:1px dashed var(--border); padding-bottom:8px;">
              DISASTER DNA ANALYSIS<br>
              <span style="color:var(--text-secondary); font-size:14px; font-weight:normal;">Zone: ${zoneId.toUpperCase()} (${areaName})</span>
            </div>
            
            <div style="margin-bottom:24px; padding:12px; background:var(--bg-sunken); border:1px solid var(--border);">
              <div style="font-size:18px; font-weight:700; color:var(--text); margin-bottom:8px;">⚠️ ${highestMatchText}% match</div>
              <div style="color:var(--text-secondary);">Similar to: <span style="color:var(--text);">${matchedProfileText}</span></div>
              <div style="color:var(--text-secondary);">Intervention window: <span style="color:var(--text);">${hoursText} hours</span></div>
            </div>

            <div style="color:var(--text-secondary); margin-bottom:16px; font-weight:600;">ALL PROFILE MATCHES:</div>
            ${barsHtml}
          </div>
        `;
        
        dnaEl.innerHTML = html;

    } catch (err) {
        console.error(err);
        dnaEl.innerHTML = `<div class="color-critical">Error: ${err.message}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
      document.addEventListener('sentinel:data-updated', (e) => {
          if (e.detail.type === 'live') {
            renderFloorplan();
          }
      });
  });
})();