// permits.js — permits.html rendering logic

// MOCK_DATA — swap the body of getPermitsData() for a fetch('/api/permits')
// call once Akshat's endpoint is live. Shape mirrors the intended API
// response so the swap only touches that one function.
const MOCK_PERMITS_RESPONSE = {
  summary: {
    active: 5,
    flagged: 2,
    blocked: 1
  },
  blocked: [
    {
      id: "permit-034",
      type: "Hot Work",
      zone: "Zone C",
      requestedBy: "Worker #07",
      requestedAt: "2026-07-07T09:12:00",
      reason:
        "This permit violates OISD-GDN-192 Section 4.2 if gas reading exceeds 10% LEL nearby. " +
        "Current Zone C gas reading: 340 PPM (14% LEL). Permit cannot be approved until gas levels " +
        "fall below the 10% LEL threshold and remain stable for at least 15 minutes.",
      ruleRef: "OISD-GDN-192 §4.2"
    }
  ],
  flagged: [
    {
      id: "permit-041",
      type: "Confined Space",
      zone: "Zone B",
      requestedBy: "Worker #11",
      requestedAt: "2026-07-07T08:47:00",
      reason:
        "Gas trend in Zone B is rising (280 PPM, up from 190 PPM ten minutes ago). Permit is not " +
        "blocked yet, but conditions are approaching the 300 PPM confined-space threshold under " +
        "OISD-GDN-192. Recommend re-checking before entry.",
      ruleRef: "OISD-GDN-192 §3.1"
    },
    {
      id: "permit-038",
      type: "Electrical",
      zone: "Zone A",
      requestedBy: "Worker #04",
      requestedAt: "2026-07-07T07:58:00",
      reason:
        "Zone A gas reading (210 PPM) combined with an active Electrical permit crosses the compound " +
        "risk threshold defined for electrical work near elevated gas concentration.",
      ruleRef: "Factory Act §36"
    }
  ],
  active: [
    {
      id: "permit-022",
      type: "Hot Work",
      zone: "Zone D",
      requestedBy: "Worker #02",
      activeSince: "2026-07-07T06:30:00"
    },
    {
      id: "permit-025",
      type: "Confined Space",
      zone: "Zone D",
      requestedBy: "Worker #09",
      activeSince: "2026-07-07T06:45:00"
    },
    {
      id: "permit-027",
      type: "Electrical",
      zone: "Zone A",
      requestedBy: "Worker #01",
      activeSince: "2026-07-07T07:00:00"
    },
    {
      id: "permit-030",
      type: "Hot Work",
      zone: "Zone B",
      requestedBy: "Worker #06",
      activeSince: "2026-07-07T07:15:00"
    },
    {
      id: "permit-033",
      type: "General Work",
      zone: "Zone C",
      requestedBy: "Worker #10",
      activeSince: "2026-07-07T08:00:00"
    }
  ]
};

async function getPermitsData() {
  // TEMP (mock):
  return MOCK_PERMITS_RESPONSE;

  // LATER (real API):
  // const res = await fetch('/api/permits');
  // if (!res.ok) throw new Error('Failed to load permits');
  // return res.json();
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

function renderSummary(summary) {
  const el = document.getElementById('permits-summary');
  el.innerHTML =
    `<strong>${summary.active}</strong> Active &middot; ` +
    `<strong>${summary.flagged}</strong> Flagged &middot; ` +
    `<strong>${summary.blocked}</strong> Blocked`;
}

function blockedCard(permit) {
  return `
    <div class="permit-card card status-blocked">
      <div class="permit-card-top">
        <span class="permit-card-title">${permit.type} — ${permit.zone}</span>
        <span class="permit-card-meta">${permit.requestedBy} · requested ${formatTime(permit.requestedAt)}</span>
      </div>
      <div class="permit-card-reason">${permit.reason}</div>
      <div class="permit-card-rule">${permit.ruleRef}</div>
    </div>
  `;
}

function flaggedCard(permit) {
  return `
    <div class="permit-card card status-flagged">
      <div class="permit-card-top">
        <span class="permit-card-title">${permit.type} — ${permit.zone}</span>
        <span class="permit-card-meta">${permit.requestedBy} · requested ${formatTime(permit.requestedAt)}</span>
      </div>
      <div class="permit-card-reason">${permit.reason}</div>
      <div class="permit-card-rule">${permit.ruleRef}</div>
    </div>
  `;
}

function activeCard(permit) {
  return `
    <div class="permit-card card status-active">
      <div class="permit-card-top">
        <span class="permit-card-title">${permit.type} — ${permit.zone}</span>
        <span class="permit-card-meta">${permit.requestedBy} · active since ${formatTime(permit.activeSince)}</span>
      </div>
    </div>
  `;
}

function renderSection(containerId, items, cardFn, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="permits-empty">${emptyMessage}</div>`;
    return;
  }
  container.innerHTML = items.map(cardFn).join('');
}

async function initPermitsPage() {
  const data = await getPermitsData();

  renderSummary(data.summary);
  renderSection('blocked-cards', data.blocked, blockedCard, 'No blocked permits.');
  renderSection('flagged-cards', data.flagged, flaggedCard, 'No flagged permits.');
  renderSection('active-cards', data.active, activeCard, 'No active permits.');
}

document.addEventListener('DOMContentLoaded', initPermitsPage);