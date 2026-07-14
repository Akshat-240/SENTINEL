// permits.js — permits.html rendering logic

(function () {
  'use strict';

  function formatTime(isoString) {
    if (!isoString) return 'Now';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString('en-GB', { hour12: false });
  }

  function renderSummary(summary) {
    const el = document.getElementById('permits-summary');
    if (!el) return;
    el.innerHTML =
      `<strong>${summary.active}</strong> Active &middot; ` +
      `<strong>${summary.flagged}</strong> Flagged &middot; ` +
      `<strong>${summary.blocked}</strong> Blocked`;
  }

  function permitCard(permit, statusClass) {
    const reasonHtml = permit.reason ? `<div class="permit-card-reason">${permit.reason}</div>` : '';
    const ruleHtml = permit.ruleRef ? `<div class="permit-card-rule">${permit.ruleRef}</div>` : '';
    const timeHtml = permit.requestedAt 
      ? `requested ${formatTime(permit.requestedAt)}` 
      : (permit.activeSince ? `active since ${formatTime(permit.activeSince)}` : '');
      
    return `
      <div class="permit-card card ${statusClass}">
        <div class="permit-card-top">
          <span class="permit-card-title">${permit.type} — ${permit.zone}</span>
          <span class="permit-card-meta">${permit.requestedBy || 'System'} · ${timeHtml}</span>
        </div>
        ${reasonHtml}
        ${ruleHtml}
      </div>
    `;
  }

  function renderSection(containerId, items, statusClass, emptyMessage) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = `<div class="permits-empty">${emptyMessage}</div>`;
      return;
    }
    container.innerHTML = items.map(p => permitCard(p, statusClass)).join('');
  }

  function render() {
    const liveData = window.SENTINEL_DATA.getLiveState();
    const active = [];
    const flagged = [];
    const blocked = []; 

    Object.values(liveData).forEach(zone => {
      const permits = zone.raw?.snapshot?.active_permits || [];
      permits.forEach(p => {
        const permitObj = {
          id: p.permit_id || 'unknown',
          type: p.type,
          zone: zone.name,
          requestedBy: p.worker_id || 'System',
          activeSince: zone.raw?.timestamp
        };
        
        if (zone.score >= 80) {
          permitObj.reason = "Zone conditions are critical. Evacuation recommended.";
          permitObj.ruleRef = "Sentinel Auto-Flag";
          flagged.push(permitObj);
        } else if (zone.score >= 50) {
          permitObj.reason = "Zone conditions elevated. Monitor closely.";
          permitObj.ruleRef = "Sentinel Auto-Flag";
          flagged.push(permitObj);
        } else {
          active.push(permitObj);
        }
      });
    });

    renderSummary({
      active: active.length,
      flagged: flagged.length,
      blocked: blocked.length
    });
    
    renderSection('blocked-cards', blocked, 'status-blocked', 'No blocked permits.');
    renderSection('flagged-cards', flagged, 'status-flagged', 'No flagged permits.');
    renderSection('active-cards', active, 'status-active', 'No active permits.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('permits-summary')) {
        render();
        document.addEventListener('sentinel:data-updated', (e) => {
          if (e.detail.type === 'live') render();
        });
    }
  });
})();