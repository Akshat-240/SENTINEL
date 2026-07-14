/* ==========================================================================
   SENTINEL — workers.js (v2)
   Single source of truth for worker data. Uses live API data from data.js.
   ========================================================================== */

(function () {
  'use strict';

  const D = window.SENTINEL_DATA || {};
  const LEVEL_VAR = D.LEVEL_VAR;
  const LEVEL_TINT_VAR = D.LEVEL_TINT_VAR;
  const ZONE_AREA_NAME = D.ZONE_AREA_NAME || {};

  const URGENCY_ORDER = ['shutdown', 'critical', 'high', 'warning', 'caution', 'normal'];

  function pillStyle(accent) {
    return `--pill-bg: var(${LEVEL_TINT_VAR[accent]}); --pill-fg: var(${LEVEL_VAR[accent]});`;
  }

  function exposureMinutes(w) {
    if (/enter/i.test(w.exposure)) return Infinity; 
    const m = parseInt(w.exposure, 10);
    return Number.isNaN(m) ? -1 : m;
  }

  function renderExposurePanel() {
    const panel = document.getElementById('workerList');
    if (!panel) return;
    
    const roster = window.SENTINEL_DATA.WORKERS || [];
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
          <div class="worker-row__meta">${w.zone}</div>
        </div>
        <div class="worker-row__right">
          <div class="worker-row__exposure">${w.exposure}</div>
          <span class="pill" style="${pillStyle(w.accent)}">${w.status}</span>
        </div>
      </div>
    `).join('');
  }

  let activeZoneFilter = 'all';
  let searchQuery = '';
  let sortState = { key: 'urgency', dir: 'asc' };

  function filteredRoster() {
    const roster = window.SENTINEL_DATA.WORKERS || [];
    return roster.filter((w) => {
      const wZoneLetter = w.zone.replace('Zone ', '');
      const zoneOk = activeZoneFilter === 'all' || wZoneLetter === activeZoneFilter;
      const q = searchQuery.trim().toLowerCase();
      const searchOk = !q
        || w.id.toLowerCase().includes(q)
        || w.status.toLowerCase().includes(q)
        || (w.permit || '').toLowerCase().includes(q)
        || (ZONE_AREA_NAME[wZoneLetter] || '').toLowerCase().includes(q);
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
        case 'shift': cmp = (a.shift || '').localeCompare(b.shift || ''); break;
        default: cmp = 0;
      }
      return cmp * dirMul;
    });
  }

  function renderSummary() {
    const el = document.getElementById('workersSummary');
    if (!el) return;
    const roster = window.SENTINEL_DATA.WORKERS || [];
    const total = roster.length;
    const flagged = roster.filter((w) => w.accent === 'caution' || w.accent === 'warning').length;
    const critical = roster.filter((w) => w.accent === 'high' || w.accent === 'critical' || w.accent === 'shutdown').length;
    el.innerHTML =
      `<strong>${total}</strong> Workers &middot; ` +
      `<strong>${flagged}</strong> Flagged &middot; ` +
      `<strong>${critical}</strong> Critical`;
  }

  function rowHtml(w) {
    const wZoneLetter = w.zone.replace('Zone ', '');
    const area = ZONE_AREA_NAME[wZoneLetter] ? ` &middot; ${ZONE_AREA_NAME[wZoneLetter]}` : '';
    return `
      <tr>
        <td class="workers-table__id">${w.id}</td>
        <td>${w.zone}${area}</td>
        <td><span class="pill" style="${pillStyle(w.accent)}"><span class="pill__dot"></span>${w.status}</span></td>
        <td class="workers-table__exposure">${w.exposure}</td>
        <td>${w.permit || 'None'}</td>
        <td>${w.shift || 'Day'}</td>
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

  function init() {
    renderExposurePanel();
    if (document.getElementById('workersTableBody')) {
      renderSummary();
      wireTableControls();
      renderTable();
    }
    
    document.addEventListener('sentinel:data-updated', (e) => {
      if (e.detail.type === 'live') {
        renderExposurePanel();
        if (document.getElementById('workersTableBody')) {
          renderSummary();
          renderTable();
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();