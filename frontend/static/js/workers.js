/* ==========================================================================
   SENTINEL — workers.js (v2)
   Single source of truth for worker data, used by two different views:
     1) index.html  #workerList        → filtered to warning/high, sorted by urgency
     2) workers.html #workersTableBody → full unfiltered roster, sortable table,
                                          zone filter tabs, search
   MOCK DATA — swap the body of getWorkersData() for a fetch('/api/workers')
   call once the backend endpoint is live. Shape mirrors the intended API
   response (same pattern as permits.js) so the swap only touches that one
   function.
   ========================================================================== */

(function () {
  'use strict';

  const D = window.SENTINEL_DATA || {};
  const LEVEL_VAR = D.LEVEL_VAR || {
    normal: '--risk-normal', caution: '--risk-caution', warning: '--risk-warning',
    high: '--risk-high', critical: '--risk-critical', shutdown: '--risk-shutdown',
  };
  const LEVEL_TINT_VAR = D.LEVEL_TINT_VAR || {
    normal: '--risk-normal-tint', caution: '--risk-caution-tint', warning: '--risk-warning-tint',
    high: '--risk-high-tint', critical: '--risk-critical-tint', shutdown: '--risk-shutdown-tint',
  };
  const ZONE_AREA_NAME = D.ZONE_AREA_NAME || {};

  // Most urgent first. Used both for the index.html panel sort and as the
  // default sort on the full roster table.
  const URGENCY_ORDER = ['shutdown', 'critical', 'high', 'warning', 'caution', 'normal'];

  const MOCK_WORKERS_RESPONSE = {
    workers: [
      { id: 'Worker #01', zone: 'A', accent: 'normal',  statusLabel: 'Monitoring',        exposure: '22 min',  permit: 'Electrical',        shift: 'Day' },
      { id: 'Worker #02', zone: 'C', accent: 'warning', statusLabel: 'Move to safe zone',  exposure: '6 min',   permit: 'Electrical',        shift: 'Night' },
      { id: 'Worker #03', zone: 'D', accent: 'normal',  statusLabel: 'Monitoring',        exposure: '40 min',  permit: 'Hot Work',          shift: 'Day' },
      { id: 'Worker #04', zone: 'B', accent: 'high',    statusLabel: 'Exit immediately',   exposure: '14 min',  permit: 'Hot Work + Confined Space', shift: 'Day' },
      { id: 'Worker #05', zone: 'E', accent: 'normal',  statusLabel: 'Monitoring',        exposure: '12 min',  permit: 'None active',       shift: 'Day' },
      { id: 'Worker #06', zone: 'B', accent: 'normal',  statusLabel: 'Monitoring',        exposure: '8 min',   permit: 'Hot Work',          shift: 'Day' },
      { id: 'Worker #07', zone: 'B', accent: 'warning', statusLabel: 'Move to safe zone',  exposure: '3 min',   permit: 'Hot Work + Confined Space', shift: 'Day' },
      { id: 'Worker #09', zone: 'D', accent: 'normal',  statusLabel: 'Monitoring',        exposure: '30 min',  permit: 'Confined Space',    shift: 'Night' },
      { id: 'Worker #10', zone: 'C', accent: 'normal',  statusLabel: 'Monitoring',        exposure: '18 min',  permit: 'General Work',      shift: 'Day' },
      { id: 'Worker #11', zone: 'B', accent: 'high',    statusLabel: 'Entry blocked',      exposure: 'Entering', permit: 'Hot Work + Confined Space', shift: 'Day' },
      { id: 'Worker #12', zone: 'F', accent: 'normal',  statusLabel: 'Monitoring',        exposure: '5 min',   permit: 'None active',       shift: 'Night' },
    ],
  };

  async function getWorkersData() {
    // TEMP (mock):
    return MOCK_WORKERS_RESPONSE;

    // LATER (real API):
    // const res = await fetch('/api/workers');
    // if (!res.ok) throw new Error('Failed to load workers');
    // return res.json();
  }

  function pillStyle(accent) {
    return `--pill-bg: var(${LEVEL_TINT_VAR[accent]}); --pill-fg: var(${LEVEL_VAR[accent]});`;
  }

  function exposureMinutes(w) {
    if (/enter/i.test(w.exposure)) return Infinity; // "Entering" is treated as most urgent
    const m = parseInt(w.exposure, 10);
    return Number.isNaN(m) ? -1 : m;
  }

  // ---------- index.html — Worker Exposure Panel (filtered, unchanged behavior) ----------
  function renderExposurePanel(roster) {
    const panel = document.getElementById('workerList');
    if (!panel) return;

    const atRisk = roster.filter((w) => w.accent !== 'normal');

    if (!atRisk.length) {
      panel.innerHTML = `
        <div class="worker-panel__empty">
          <div class="worker-panel__empty-dot"></div>
          All workers currently in safe zones.
        </div>`;
      return;
    }

    const sorted = [...atRisk].sort(
      (a, b) => URGENCY_ORDER.indexOf(a.accent) - URGENCY_ORDER.indexOf(b.accent)
    );

    panel.innerHTML = sorted.map((w) => `
      <div class="worker-row">
        <div>
          <div class="worker-row__id">${w.id}</div>
          <div class="worker-row__meta">Zone ${w.zone}</div>
        </div>
        <div class="worker-row__right">
          <div class="worker-row__exposure">${w.exposure}</div>
          <span class="pill" style="${pillStyle(w.accent)}">${w.statusLabel}</span>
        </div>
      </div>
    `).join('');
  }

  // ---------- workers.html — full roster table ----------
  let roster = [];
  let activeZoneFilter = 'all';
  let searchQuery = '';
  let sortState = { key: 'urgency', dir: 'asc' };

  function filteredRoster() {
    return roster.filter((w) => {
      const zoneOk = activeZoneFilter === 'all' || w.zone === activeZoneFilter;
      const q = searchQuery.trim().toLowerCase();
      const searchOk = !q
        || w.id.toLowerCase().includes(q)
        || w.statusLabel.toLowerCase().includes(q)
        || w.permit.toLowerCase().includes(q)
        || (ZONE_AREA_NAME[w.zone] || '').toLowerCase().includes(q);
      return zoneOk && searchOk;
    });
  }

  function sortRoster(list) {
    const dirMul = sortState.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortState.key) {
        case 'id': cmp = a.id.localeCompare(b.id, undefined, { numeric: true }); break;
        case 'zone': cmp = a.zone.localeCompare(b.zone); break;
        case 'urgency': cmp = URGENCY_ORDER.indexOf(a.accent) - URGENCY_ORDER.indexOf(b.accent); break;
        case 'exposure': cmp = exposureMinutes(a) - exposureMinutes(b); break;
        case 'shift': cmp = a.shift.localeCompare(b.shift); break;
        default: cmp = 0;
      }
      return cmp * dirMul;
    });
  }

  function renderSummary() {
    const el = document.getElementById('workersSummary');
    if (!el) return;
    const total = roster.length;
    const flagged = roster.filter((w) => w.accent === 'caution' || w.accent === 'warning').length;
    const critical = roster.filter((w) => w.accent === 'high' || w.accent === 'critical' || w.accent === 'shutdown').length;
    el.innerHTML =
      `<strong>${total}</strong> Workers &middot; ` +
      `<strong>${flagged}</strong> Flagged &middot; ` +
      `<strong>${critical}</strong> Critical`;
  }

  function rowHtml(w) {
    const area = ZONE_AREA_NAME[w.zone] ? ` &middot; ${ZONE_AREA_NAME[w.zone]}` : '';
    return `
      <tr>
        <td class="workers-table__id">${w.id}</td>
        <td>Zone ${w.zone}${area}</td>
        <td><span class="pill" style="${pillStyle(w.accent)}"><span class="pill__dot"></span>${w.statusLabel}</span></td>
        <td class="workers-table__exposure">${w.exposure}</td>
        <td>${w.permit}</td>
        <td>${w.shift}</td>
      </tr>
    `;
  }

  function renderTable() {
    const tbody = document.getElementById('workersTableBody');
    if (!tbody) return;

    const list = sortRoster(filteredRoster());

    tbody.innerHTML = list.length
      ? list.map(rowHtml).join('')
      : `<tr class="workers-table__empty-row"><td colspan="6">No workers match this filter.</td></tr>`;

    document.querySelectorAll('.workers-table thead th[data-sort]').forEach((th) => {
      th.classList.toggle('is-sorted', th.dataset.sort === sortState.key);
    });
  }

  function wireTableControls() {
    document.querySelectorAll('.workers-table thead th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortState.key === key) {
          sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
          sortState = { key, dir: 'asc' };
        }
        renderTable();
      });
    });

    document.querySelectorAll('.workers-zone-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.workers-zone-tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        activeZoneFilter = tab.dataset.zone;
        renderTable();
      });
    });

    const search = document.getElementById('workersSearch');
    if (search) {
      search.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTable();
      });
    }
  }

  // ---------- Init ----------
  async function init() {
    roster = (await getWorkersData()).workers;

    renderExposurePanel(roster);

    if (document.getElementById('workersTableBody')) {
      renderSummary();
      wireTableControls();
      renderTable();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();