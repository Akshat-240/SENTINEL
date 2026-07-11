/* ==========================================================================
   SENTINEL — report.js
   Auto-Generated Incident Report (report.html). Section order matches
   sentinel_frontend.md: 1 Summary → 6 Recommended Actions → 2 Event Timeline
   → 3 Compound Factors → 5 Regulatory Violations → 7 Evidence Log →
   4 Historical Similarity (closing section).

   Peak score, alert level, duration, event timeline, and the evidence log
   are computed LIVE from window.SENTINEL_DATA.TICKS (data.js) — change the
   incident data there and this page updates automatically.

   Compound Factors / Regulatory Violations / Recommended Actions /
   Historical Similarity are the output of modules that don't exist on the
   frontend yet (Compound Risk Engine, Regulatory Shadow Twin, RAG) — these
   are MOCKED here, same "swap this one function for the real API later"
   pattern used in permits.js.
   ========================================================================== */

(function () {
  'use strict';

  const D = window.SENTINEL_DATA;
  const { TICKS, ZONE_AREA_NAME, LEVEL_LABEL, LEVEL_VAR, LEVEL_TINT_VAR, LEVEL_ORDER } = D;

  // ---------- Mock module output (swap for real API once backend is live) ----------
  const MOCK_REPORT_EXTRAS = {
    incidentId: 'INC-20260711-ZB',
    primaryZone: 'B',
    recommendedActions: [
      'Suspend all Hot Work and Confined Space permits in Zone B for a minimum of 4 hours following shutdown.',
      'Conduct a full gas leak inspection of the Coke Oven Battery (Zone B) before resuming any operations.',
      'Review worker rotation procedure — Worker #04 exceeded 10 minutes of exposure before the evacuation order was issued.',
      'Retrain shift supervisors on compound risk thresholds, specifically Hot Work + Confined Space + Gas > 300 PPM.',
      'Re-verify Zone C and Zone A sensor calibration — both zones showed a secondary caution-level rise during the incident.',
    ],
    compoundFactors: [
      { text: 'Hot Work Permit + Gas > 500 PPM', points: '+15' },
      { text: 'Confined Space Permit + Gas > 300 PPM', points: '+15' },
      { text: 'Hot Work + Confined Space + Gas > 300 PPM', points: '+20' },
    ],
    violations: [
      {
        title: 'Hot Work Permit continued during rising gas concentration',
        zone: 'Zone B',
        ruleRef: 'OISD-GDN-192 §4.2',
        text: 'Hot Work permit remained active as Zone B gas readings crossed 300 PPM and continued rising. OISD-GDN-192 §4.2 requires immediate suspension of hot work once gas exceeds 10% LEL in the vicinity; Zone B reached 14% LEL equivalent before the permit was revoked.',
        accent: 'high',
      },
      {
        title: 'Confined Space entry authorized above safe exposure limit',
        zone: 'Zone B',
        ruleRef: 'Factory Act §36',
        text: 'Worker #11 was authorized to enter Zone B while gas concentration already exceeded the confined-space entry threshold, in violation of Factory Act §36 provisions on hazardous atmosphere entry.',
        accent: 'critical',
      },
    ],
    historicalSimilarity: {
      percent: 73,
      profile: 'Visakhapatnam Steel Plant pre-incident profile',
      window: 'Estimated intervention window: 6 hours',
    },
  };

  async function getReportExtras() {
    // TEMP (mock):
    return MOCK_REPORT_EXTRAS;

    // LATER (real API — Gemini-generated report from the Emergency Orchestrator):
    // const res = await fetch('/api/report');
    // if (!res.ok) throw new Error('Failed to load report');
    // return res.json();
  }

  // ---------- Helpers ----------
  function timeToSeconds(t) {
    const parts = t.split(':').map(Number);
    return parts.length === 2
      ? parts[0] * 3600 + parts[1] * 60
      : parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  function formatDuration(startTime, endTime) {
    const totalSeconds = timeToSeconds(endTime) - timeToSeconds(startTime);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return secs ? `${mins}m ${secs}s` : `${mins} min`;
  }

  function pillStyle(level) {
    return `--pill-bg: var(${LEVEL_TINT_VAR[level]}); --pill-fg: var(${LEVEL_VAR[level]});`;
  }

  function findPeak() {
    let peak = null;
    TICKS.forEach((tick) => {
      Object.entries(tick.zones).forEach(([zid, z]) => {
        if (!peak || z.score > peak.score) {
          peak = { score: z.score, level: z.level, zoneId: zid, time: tick.time };
        }
      });
    });
    return peak;
  }

  function zonesInvolved() {
    // Any zone that reached caution or above at any point during the incident.
    const involved = new Set();
    TICKS.forEach((tick) => {
      Object.entries(tick.zones).forEach(([zid, z]) => {
        if (LEVEL_ORDER.indexOf(z.level) >= LEVEL_ORDER.indexOf('caution')) involved.add(zid);
      });
    });
    return Array.from(involved);
  }

  // ---------- Header ----------
  function renderHeader(extras) {
    const involved = zonesInvolved();
    const generated = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });

    document.getElementById('reportTitle').textContent =
      `Incident Report — Zone ${extras.primaryZone} (${ZONE_AREA_NAME[extras.primaryZone]})`;

    document.getElementById('reportMeta').innerHTML = `
      <span><strong>Incident ID:</strong> ${extras.incidentId}</span>
      <span><strong>Generated:</strong> ${generated}</span>
      <span><strong>Zones involved:</strong> ${involved.map((z) => `${z} (${ZONE_AREA_NAME[z]})`).join(', ')}</span>
    `;
  }

  // ---------- 1. Summary Strip ----------
  function renderSummary(peak) {
    const duration = formatDuration(TICKS[0].time, TICKS[TICKS.length - 1].time);
    const el = document.getElementById('summaryStrip');
    el.innerHTML = `
      <div class="card report-summary-stat">
        <div class="report-summary-stat__label">Peak Risk Score</div>
        <div class="report-summary-stat__value">${peak.score}</div>
      </div>
      <div class="card report-summary-stat">
        <div class="report-summary-stat__label">Alert Level Reached</div>
        <div class="report-summary-stat__pill-row">
          <span class="pill" style="${pillStyle(peak.level)}">
            <span class="pill__dot"></span>${LEVEL_LABEL[peak.level]}
          </span>
        </div>
      </div>
      <div class="card report-summary-stat">
        <div class="report-summary-stat__label">Duration</div>
        <div class="report-summary-stat__value">${duration}</div>
      </div>
    `;
  }

  // ---------- 6. Recommended Actions ----------
  function renderActions(extras) {
    document.getElementById('recommendedActions').innerHTML =
      extras.recommendedActions.map((a) => `<li>${a}</li>`).join('');
  }

  // ---------- 2. Event Timeline (condensed, static — key events only) ----------
  function renderTimeline() {
    const keyTicks = TICKS.filter((t) => t.event !== null);
    const el = document.getElementById('eventTimeline');

    el.innerHTML = keyTicks.map((tick) => {
      const worstZoneId = Object.entries(tick.zones).sort(
        (a, b) => LEVEL_ORDER.indexOf(b[1].level) - LEVEL_ORDER.indexOf(a[1].level)
      )[0][0];
      const z = tick.zones[worstZoneId];
      const accent = `var(${LEVEL_VAR[z.level]})`;
      return `
        <div class="report-timeline-entry" style="--entry-color:${accent}">
          <div class="report-timeline-entry__dot"></div>
          <div class="report-timeline-entry__row">
            <span class="report-timeline-entry__time">${tick.time}</span>
            <span class="report-timeline-entry__text">${tick.event}</span>
            <span class="report-timeline-entry__score">${LEVEL_LABEL[z.level]} · ${z.score}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---------- 3. Compound Factors Detected ----------
  function renderCompoundFactors(extras) {
    document.getElementById('compoundFactors').innerHTML = extras.compoundFactors.map((f) => `
      <div class="report-factor-row">
        <span>${f.text}</span>
        <span class="report-factor-row__points">${f.points}</span>
      </div>
    `).join('');
  }

  // ---------- 5. Regulatory Violations Flagged ----------
  function renderViolations(extras) {
    document.getElementById('regulatoryViolations').innerHTML = extras.violations.map((v) => `
      <div class="report-violation" style="--violation-color: var(${LEVEL_VAR[v.accent]})">
        <div class="report-violation__top">
          <span class="report-violation__title">${v.title}</span>
          <span class="report-violation__meta">${v.zone}</span>
        </div>
        <div class="report-violation__text">${v.text}</div>
        <div class="report-violation__rule">${v.ruleRef}</div>
      </div>
    `).join('');
  }

  // ---------- 7. Timestamped Evidence Log ----------
  function renderEvidenceLog(extras) {
    const zid = extras.primaryZone;
    const rows = TICKS.map((tick) => {
      const z = tick.zones[zid];
      return `
        <tr>
          <td>${tick.time}</td>
          <td>Zone ${zid}</td>
          <td>Gas / Temp</td>
          <td>${z.gas} PPM / ${z.temp}°C</td>
          <td>${z.score}</td>
        </tr>
      `;
    }).join('');
    document.getElementById('evidenceLog').innerHTML = rows;
  }

  // ---------- 4. Historical Similarity (closing section) ----------
  function renderSimilarity(extras) {
    const s = extras.historicalSimilarity;
    document.getElementById('historicalSimilarity').innerHTML = `
      <div class="report-similarity__value">${s.percent}%</div>
      <div class="report-similarity__label">Current pattern is ${s.percent}% similar to the ${s.profile}.</div>
      <div class="report-similarity__window">${s.window}</div>
    `;
  }

  // ---------- Download PDF ----------
  function wireDownload() {
    const btn = document.getElementById('downloadPdfBtn');
    if (btn) btn.addEventListener('click', () => window.print());
  }

  

  // ---------- Init ----------
  async function init() {
    const extras = await getReportExtras();
    const peak = findPeak();

    renderHeader(extras);
    renderSummary(peak);
    renderActions(extras);
    renderTimeline();
    renderCompoundFactors(extras);
    renderViolations(extras);
    renderEvidenceLog(extras);
    renderSimilarity(extras);
    wireDownload();
    
  }

  document.addEventListener('DOMContentLoaded', init);
})();