/* ==========================================================================
   SENTINEL — replay.js (ASCII Timeline)
   ========================================================================== */

(function () {
  'use strict';

  function renderTimeline() {
    const historicalTicks = window.SENTINEL_DATA.getHistoricalTicks();
    const timelineEl = document.getElementById('replayTimeline');
    if (!timelineEl) return;

    if (historicalTicks.length === 0) {
      timelineEl.innerHTML = '<div style="color:var(--text-muted)">No historical events logged yet. Waiting for orchestrator loop...</div>';
      timelineEl.classList.remove('loading-overlay');
      return;
    }

    const html = historicalTicks.map(tick => {
      // Find highest risk zone in this tick
      let maxScore = 0;
      let maxZone = '';
      Object.keys(tick.zones).forEach(z => {
        if (tick.zones[z].score > maxScore) {
          maxScore = tick.zones[z].score;
          maxZone = z;
        }
      });

      let colorClass = 'color-normal';
      if (maxScore >= 75) colorClass = 'color-critical';
      else if (maxScore >= 50) colorClass = 'color-warning';
      else if (maxScore >= 30) colorClass = 'color-caution';

      return `
        <div style="display:flex; gap:16px; margin-bottom:16px; font-family:var(--font-mono);">
          <div style="width:100px; color:var(--text-secondary); border-right:1px solid var(--border); padding-right:16px; text-align:right;">
            ${tick.time}
          </div>
          <div style="flex:1;">
            <div class="${colorClass}" style="font-weight:600; margin-bottom:4px;">
              Max Risk: ${maxScore} (Zone ${maxZone})
            </div>
            <div style="color:var(--text-muted); font-size:12px;">
              ${tick.event || 'Routine telemetry logged'}
            </div>
          </div>
        </div>
      `;
    }).join('');

    timelineEl.innerHTML = html;
    timelineEl.classList.remove('loading-overlay');
    
    // Auto scroll to bottom
    timelineEl.scrollTop = timelineEl.scrollHeight;
  }

  document.addEventListener('DOMContentLoaded', () => {
      document.addEventListener('sentinel:data-updated', (e) => {
          if (e.detail.type === 'historical') {
            renderTimeline();
          }
      });
  });
})();