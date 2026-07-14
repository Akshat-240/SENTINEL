/* ==========================================================================
   SENTINEL — data.js (LIVE API INTEGRATED)
   ========================================================================== */

window.SENTINEL_DATA = (function () {
  'use strict';

  const ZONE_COORDS = {
    A: { lat: 17.6210, lng: 83.1840 },
    B: { lat: 17.6230, lng: 83.2020 },
    C: { lat: 17.6040, lng: 83.1860 },
    D: { lat: 17.6060, lng: 83.2040 },
    E: { lat: 17.6180, lng: 83.1950 },
    F: { lat: 17.6090, lng: 83.1920 },
  };

  const ZONE_AREA_NAME = {
    A: 'Sinter Plant', B: 'Coke Oven Battery', C: 'Blast Furnace Area',
    D: 'Steel Melt Shop', E: 'Rolling Mill', F: 'Raw Material Yard',
  };

  const LEVEL_ORDER = ['normal', 'caution', 'warning', 'high', 'critical', 'shutdown'];
  const LEVEL_LABEL = {
    normal: 'Normal', caution: 'Caution', warning: 'Warning',
    high: 'High Risk', critical: 'Critical', shutdown: 'Emergency Shutdown',
  };
  const LEVEL_VAR = {
    normal: '--risk-normal', caution: '--risk-caution', warning: '--risk-warning',
    high: '--risk-high', critical: '--risk-critical', shutdown: '--risk-shutdown',
  };
  const LEVEL_TINT_VAR = {
    normal: '--risk-normal-tint', caution: '--risk-caution-tint', warning: '--risk-warning-tint',
    high: '--risk-high-tint', critical: '--risk-critical-tint', shutdown: '--risk-shutdown-tint',
  };

  const WORKER_URGENCY_ORDER = ['Exit immediately', 'Entry blocked', 'Move to safe zone'];

  // Application State
  let liveState = {};
  let historicalTicks = fallbackTicks();
  let globalWorkers = [];

  function fallbackTicks() {
    const dummy = { score: 0, level: 'normal', gas: 0, temp: 0, permits: 'None', workers: [] };
    return [{ time: '00:00:00', zones: { A:dummy, B:dummy, C:dummy, D:dummy, E:dummy, F:dummy } }];
  }

  // Polling backend
  async function pollLiveState() {
    try {
      const res = await fetch('http://localhost:5000/api/risk/all');
      if (!res.ok) throw new Error('API error');
      const rawData = await res.json();
      
      const newLiveState = {};
      const newWorkers = [];
      
      rawData.forEach(zone => {
        const shortId = zone.zone_id.toUpperCase().replace('ZONE_', '');
        let permitStr = 'None active';
        if (zone.snapshot && zone.snapshot.active_permits.length) {
            permitStr = zone.snapshot.active_permits.map(p => p.type).join(' + ');
        }
        
        const workers = (zone.snapshot.workers || []).map(w => {
            let status = 'Move to safe zone';
            let accent = 'warning';
            if (zone.final_score > 80) { status = 'Exit immediately'; accent = 'high'; }
            else if (zone.final_score < 40) { status = 'Active'; accent = 'normal'; }
            
            const wObj = { id: w.worker_id, status, accent, exposure: 'Active', zone: `Zone ${shortId}` };
            newWorkers.push(wObj);
            return wObj;
        });

        newLiveState[shortId] = {
          score: zone.final_score,
          level: (zone.alert_level.level || 'normal').toLowerCase(),
          levelLabel: zone.alert_level.level,
          gas: zone.snapshot.gas_ppm,
          temp: zone.snapshot.temperature,
          permits: permitStr,
          workers: workers,
          note: zone.alert_level.action,
          raw: zone 
        };
      });
      
      liveState = newLiveState;
      globalWorkers = newWorkers;
      document.dispatchEvent(new CustomEvent('sentinel:data-updated', { detail: { type: 'live' } }));
    } catch (err) {
      console.error('Failed to fetch live state:', err);
    }
  }

  async function pollReplayTimeline() {
    try {
      const res = await fetch('http://localhost:5000/api/replay/all_zones');
      if (!res.ok) throw new Error('API error');
      const allTimelines = await res.json();
      
      const timestampMap = {};
      Object.keys(allTimelines).forEach(zoneId => {
        const shortId = zoneId.toUpperCase().replace('ZONE_', '');
        allTimelines[zoneId].forEach(event => {
            const dateObj = new Date(event.timestamp);
            const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;
            
            if (!timestampMap[event.timestamp]) {
                // Pre-fill with dummies so missing zones in a tick don't break UI
                const dummy = { score: 0, level: 'normal', gas: 0, temp: 0, permits: 'None', workers: [] };
                timestampMap[event.timestamp] = { time: timeStr, rawTime: event.timestamp, event: event.event_flag, zones: {A:dummy,B:dummy,C:dummy,D:dummy,E:dummy,F:dummy} };
            }
            timestampMap[event.timestamp].zones[shortId] = {
                score: event.risk_score,
                level: (event.alert_level || 'normal').toLowerCase(),
                gas: event.gas_ppm,
                temp: event.temperature,
                permits: 'Replay Data', 
                workers: [] 
            };
        });
      });
      
      const sortedTicks = Object.values(timestampMap).sort((a, b) => new Date(a.rawTime) - new Date(b.rawTime));
      if (sortedTicks.length > 0) {
          historicalTicks = sortedTicks;
          document.dispatchEvent(new CustomEvent('sentinel:data-updated', { detail: { type: 'historical' } }));
      }
      
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    }
  }

  // Start polling
  setInterval(pollLiveState, 2000);
  setInterval(pollReplayTimeline, 5000);
  pollLiveState();
  pollReplayTimeline();

  return {
    ZONE_COORDS,
    ZONE_AREA_NAME,
    LEVEL_ORDER,
    LEVEL_LABEL,
    LEVEL_VAR,
    LEVEL_TINT_VAR,
    WORKER_URGENCY_ORDER,
    
    getLiveState: () => liveState,
    getHistoricalTicks: () => historicalTicks,
    getTickIndexForTimestamp: (ts) => {
        const exact = historicalTicks.findIndex((t) => t.time === ts);
        if (exact !== -1) return exact;
        return historicalTicks.length - 1;
    },
    getTickByIndex: (i) => historicalTicks[Math.max(0, Math.min(i, historicalTicks.length - 1))],
    
    get TICKS() { return historicalTicks; },
    get tickCount() { return historicalTicks.length; },
    get WORKERS() { return globalWorkers; }
  };
})();