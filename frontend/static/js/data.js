/* ==========================================================================
   SENTINEL — data.js
   PURE DATA ONLY. No rendering, no DOM, no logic — just the datasets every
   page's own script (heatmap.js, replay.js, workers.js, alerts.js,
   permits.js) reads from. Load this file BEFORE common.js and BEFORE any
   page-specific script.

   MOCK DATA — swap TICKS/WORKERS for real API/SQLite-backed fetches once
   backend endpoints are live. Everything reading window.SENTINEL_DATA
   stays the same; only where these values come from changes.
   ========================================================================== */

window.SENTINEL_DATA = (function () {
  'use strict';

  // ---------- Zones ----------
  const ZONE_COORDS = {
    A: { lat: 17.6210, lng: 83.1840 },
    B: { lat: 17.6230, lng: 83.2020 },
    C: { lat: 17.6040, lng: 83.1860 },
    D: { lat: 17.6060, lng: 83.2040 },
    E: { lat: 17.6180, lng: 83.1950 },
    F: { lat: 17.6090, lng: 83.1920 },
  };

  const ZONE_AREA_NAME = {
    A: 'Sinter Plant',
    B: 'Coke Oven Battery',
    C: 'Blast Furnace Area',
    D: 'Steel Melt Shop',
    E: 'Rolling Mill',
    F: 'Raw Material Yard',
  };

  // ---------- Alert level vocabulary ----------
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

  // ---------- Incident tick timeline (Module 10 shape) ----------
  // timestamp / zone / gas / temp / permits / workers / risk score / alert level / event flag
  const TICKS = [
    {
      time: '09:01', event: null,
      zones: {
        A: { score: 12, level: 'normal', gas: 18, temp: 31, permits: 'None active', workers: [] },
        B: { score: 12, level: 'normal', gas: 20, temp: 33, permits: 'None active', workers: [] },
        C: { score: 22, level: 'normal', gas: 130, temp: 39, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
        E: { score: 10, level: 'normal', gas: 15, temp: 28, permits: 'None active', workers: [] },
        F: { score: 8,  level: 'normal', gas: 10, temp: 27, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:05', event: null,
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: { score: 18, level: 'normal', gas: 45, temp: 36, permits: 'None active', workers: [] },
        C: { score: 24, level: 'normal', gas: 138, temp: 39, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
        E: { score: 10, level: 'normal', gas: 15, temp: 28, permits: 'None active', workers: [] },
        F: { score: 8,  level: 'normal', gas: 10, temp: 27, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:07', event: 'Permit Issued — Zone B (Hot Work)',
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: { score: 35, level: 'caution', gas: 95, temp: 42, permits: 'Hot Work', workers: [] },
        C: { score: 27, level: 'normal', gas: 145, temp: 40, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
        E: { score: 10, level: 'normal', gas: 15, temp: 28, permits: 'None active', workers: [] },
        F: { score: 8,  level: 'normal', gas: 10, temp: 27, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:09', event: 'Worker entered Zone B',
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: {
          score: 61, level: 'warning', gas: 210, temp: 49, permits: 'Hot Work + Confined Space',
          workers: [{ id: 'Worker #07', status: 'Move to safe zone', accent: 'warning', exposure: '3 min' }],
        },
        C: { score: 30, level: 'caution', gas: 165, temp: 41, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
        E: { score: 10, level: 'normal', gas: 15, temp: 28, permits: 'None active', workers: [] },
        F: { score: 8,  level: 'normal', gas: 10, temp: 27, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:10', event: 'Zone B gas spike detected',
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: {
          score: 79, level: 'high', gas: 480, temp: 55, permits: 'Hot Work + Confined Space',
          workers: [
            { id: 'Worker #04', status: 'Exit immediately', accent: 'high', exposure: '9 min' },
            { id: 'Worker #07', status: 'Move to safe zone', accent: 'warning', exposure: '6 min' },
          ],
        },
        C: { score: 33, level: 'caution', gas: 172, temp: 41, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
        E: { score: 10, level: 'normal', gas: 15, temp: 28, permits: 'None active', workers: [] },
        F: { score: 8,  level: 'normal', gas: 10, temp: 27, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:10:30', event: 'Compound risk bonus triggered — Hot Work + Gas > 500 PPM',
      zones: {
        A: { score: 14, level: 'normal', gas: 19, temp: 31, permits: 'None active', workers: [] },
        B: {
          score: 88, level: 'critical', gas: 610, temp: 58, permits: 'Hot Work + Confined Space',
          workers: [
            { id: 'Worker #04', status: 'Exit immediately', accent: 'high', exposure: '11 min' },
            { id: 'Worker #07', status: 'Move to safe zone', accent: 'warning', exposure: '8 min' },
            { id: 'Worker #11', status: 'Entry blocked', accent: 'high', exposure: 'Entering' },
          ],
        },
        C: { score: 34, level: 'caution', gas: 174, temp: 41, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
        E: { score: 10, level: 'normal', gas: 15, temp: 28, permits: 'None active', workers: [] },
        F: { score: 8,  level: 'normal', gas: 10, temp: 27, permits: 'None active', workers: [] },
      },
    },
    {
      time: '09:11', event: 'ALERT TRIGGERED — Emergency Shutdown',
      zones: {
        A: { score: 16, level: 'caution', gas: 22, temp: 32, permits: 'None active', workers: [] },
        B: {
          score: 97, level: 'shutdown', gas: 847, temp: 63, permits: 'All permits suspended',
          workers: [
            { id: 'Worker #04', status: 'Exit immediately', accent: 'high', exposure: '14 min' },
            { id: 'Worker #07', status: 'Move to safe zone', accent: 'warning', exposure: '11 min' },
            { id: 'Worker #11', status: 'Entry blocked', accent: 'high', exposure: 'Entering' },
          ],
        },
        C: { score: 36, level: 'caution', gas: 176, temp: 41, permits: 'Electrical', workers: [] },
        D: { score: 15, level: 'normal', gas: 12, temp: 29, permits: 'None active', workers: [] },
        E: { score: 10, level: 'normal', gas: 15, temp: 28, permits: 'None active', workers: [] },
        F: { score: 8,  level: 'normal', gas: 10, temp: 27, permits: 'None active', workers: [] },
      },
    },
  ];

  // ---------- Dashboard Worker Exposure Panel (live/current only, not tick-indexed yet) ----------
  const WORKERS = [
    { id: 'Worker #04', zone: 'Zone B', exposure: '14 min', status: 'Exit immediately', accent: 'high' },
    { id: 'Worker #11', zone: 'Zone B', exposure: 'Entering', status: 'Entry blocked', accent: 'high' },
    { id: 'Worker #07', zone: 'Zone B', exposure: '3 min', status: 'Move to safe zone', accent: 'warning' },
    { id: 'Worker #02', zone: 'Zone C', exposure: '6 min', status: 'Move to safe zone', accent: 'warning' },
  ];

  const WORKER_URGENCY_ORDER = ['Exit immediately', 'Entry blocked', 'Move to safe zone'];

  // ---------- Helpers (still pure data lookups, not rendering) ----------
  function getTickIndexForTimestamp(ts) {
    if (!ts) return TICKS.length - 1;
    const exact = TICKS.findIndex((t) => t.time === ts);
    if (exact !== -1) return exact;
    let idx = 0;
    for (let i = 0; i < TICKS.length; i++) {
      if (TICKS[i].time <= ts) idx = i;
    }
    return idx;
  }

  function getTickByIndex(i) {
    return TICKS[Math.max(0, Math.min(i, TICKS.length - 1))];
  }

  return {
    ZONE_COORDS,
    ZONE_AREA_NAME,
    LEVEL_ORDER,
    LEVEL_LABEL,
    LEVEL_VAR,
    LEVEL_TINT_VAR,
    TICKS,
    tickCount: TICKS.length,
    WORKERS,
    WORKER_URGENCY_ORDER,
    getTickIndexForTimestamp,
    getTickByIndex,
  };
})();