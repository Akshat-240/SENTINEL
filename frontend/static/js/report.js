/* ==========================================================================
   SENTINEL — report.js (LIVE)
   ========================================================================== */

(function () {
  'use strict';

  const D = window.SENTINEL_DATA;
  const { ZONE_AREA_NAME, LEVEL_LABEL, LEVEL_VAR, LEVEL_TINT_VAR, LEVEL_ORDER } = D;

  async function getReportExtras() {
    // Determine highest risk zone from live state
    const liveState = window.SENTINEL_DATA.getLiveState();
    let highestZoneId = 'B';
    let highestScore = -1;
    Object.keys(liveState).forEach(zid => {
      if (liveState[zid].score > highestScore) {
        highestScore = liveState[zid].score;
        highestZoneId = zid;
      }
    });

    const res = await fetch('http://localhost:5000/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: `ZONE_${highestZoneId}` })
    });
    if (!res.ok) throw new Error('Failed to load report');
    const data = await res.json();
    return {
      incidentId: `INC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${highestZoneId}`,
      primaryZone: highestZoneId,
      recommendedActions: data.emergency_actions_taken || ["Maintain monitoring"],
      compoundFactors: Object.entries(data.risk_breakdown?.compound_bonus?.combinations_detected || {}).map(([k,v]) => ({
          text: v, points: ''
      })),
      violations: (data.regulatory_violations || []).map(v => ({
          title: v.description,
          zone: `Zone ${highestZoneId}`,
          ruleRef: v.code,
          text: v.remedy,
          accent: v.severity === 'CRITICAL' ? 'critical' : (v.severity === 'HIGH' ? 'high' : 'warning')
      })),
      historicalSimilarity: {
          percent: data.historical_context?.similar_incidents?.[0]?.relevance || 'N/A',
          profile: data.historical_context?.similar_incidents?.[0]?.incident || 'No similar incidents found',
          window: 'Based on historical analysis'
      },
      geminiAnalysis: data.gemini_analysis,
      rawScore: highestScore,
      rawLevel: liveState[highestZoneId].level
    };
  }

  // ---------- Helpers ----------
  function pillStyle(level) {
    return `--pill-bg: var(${LEVEL_TINT_VAR[level] || '--risk-normal-tint'}); --pill-fg: var(${LEVEL_VAR[level] || '--risk-normal'});`;
  }

  // ---------- Header ----------
  function renderHeader(extras) {
    const generated = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });

    document.getElementById('reportTitle').textContent =
      `Incident Report — Zone ${extras.primaryZone} (${ZONE_AREA_NAME[extras.primaryZone]})`;

    document.getElementById('reportMeta').innerHTML = `
      <span><strong>Incident ID:</strong> ${extras.incidentId}</span>
      <span><strong>Generated:</strong> ${generated}</span>
      <span><strong>Primary Zone:</strong> Zone ${extras.primaryZone}</span>
    `;
  }

  // ---------- 1. Summary Strip ----------
  function renderSummary(extras) {
    const el = document.getElementById('summaryStrip');
    if(!el) return;
    el.innerHTML = `
      <div class="card report-summary-stat">
        <div class="report-summary-stat__label">Peak Risk Score</div>
        <div class="report-summary-stat__value">${extras.rawScore}</div>
      </div>
      <div class="card report-summary-stat">
        <div class="report-summary-stat__label">Alert Level Reached</div>
        <div class="report-summary-stat__pill-row">
          <span class="pill" style="${pillStyle(extras.rawLevel)}">
            <span class="pill__dot"></span>${LEVEL_LABEL[extras.rawLevel] || 'Normal'}
          </span>
        </div>
      </div>
      <div class="card report-summary-stat">
        <div class="report-summary-stat__label">AI Analysis</div>
        <div class="report-summary-stat__value" style="font-size: 14px; margin-top: 8px;">Sentinel Core Engaged</div>
      </div>
    `;
  }

  // ---------- 6. Recommended Actions ----------
  function renderActions(extras) {
    const el = document.getElementById('recommendedActions');
    if(!el) return;
    if (extras.recommendedActions.length) {
      el.innerHTML = extras.recommendedActions.map((a) => `<li>${a}</li>`).join('');
    } else {
      el.innerHTML = `<li>No immediate actions recommended.</li>`;
    }
  }

  // ---------- 2. Event Timeline ----------
  function renderTimeline() {
    const el = document.getElementById('eventTimeline');
    if(!el) return;
    const ticks = window.SENTINEL_DATA.getHistoricalTicks();
    const keyTicks = ticks.filter((t) => t.event);
    
    if (!keyTicks.length) {
        el.innerHTML = `<p style="padding-left: 20px;">No major timeline events recorded for this session.</p>`;
        return;
    }

    el.innerHTML = keyTicks.map((tick) => {
      let worstZoneId = 'A';
      let worstScore = -1;
      let worstLevel = 'normal';
      Object.entries(tick.zones).forEach(([zid, z]) => {
          if (z.score > worstScore) { worstScore = z.score; worstZoneId = zid; worstLevel = z.level; }
      });
      const accent = `var(${LEVEL_VAR[worstLevel]})`;
      return `
        <div class="report-timeline-entry" style="--entry-color:${accent}">
          <div class="report-timeline-entry__dot"></div>
          <div class="report-timeline-entry__row">
            <span class="report-timeline-entry__time">${tick.time}</span>
            <span class="report-timeline-entry__text">${tick.event}</span>
            <span class="report-timeline-entry__score">${LEVEL_LABEL[worstLevel]} · ${worstScore}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---------- 3. Compound Factors Detected ----------
  function renderCompoundFactors(extras) {
    const el = document.getElementById('compoundFactors');
    if(!el) return;
    if (extras.compoundFactors.length) {
      el.innerHTML = extras.compoundFactors.map((f) => `
        <div class="report-factor-row">
          <span>${f.text}</span>
          <span class="report-factor-row__points">${f.points}</span>
        </div>
      `).join('');
    } else {
      el.innerHTML = `<div class="report-factor-row"><span>No compound risk combinations detected.</span></div>`;
    }
  }

  // ---------- 5. Regulatory Violations Flagged ----------
  function renderViolations(extras) {
    const el = document.getElementById('regulatoryViolations');
    if(!el) return;
    if (extras.violations.length) {
      el.innerHTML = extras.violations.map((v) => `
        <div class="report-violation" style="--violation-color: var(${LEVEL_VAR[v.accent] || '--risk-warning'})">
          <div class="report-violation__top">
            <span class="report-violation__title">${v.title}</span>
            <span class="report-violation__meta">${v.zone}</span>
          </div>
          <div class="report-violation__text">${v.text}</div>
          <div class="report-violation__rule">${v.ruleRef}</div>
        </div>
      `).join('');
    } else {
      el.innerHTML = `<p>No regulatory violations detected.</p>`;
    }
  }

  // ---------- 7. Timestamped Evidence Log ----------
  function renderEvidenceLog(extras) {
    const el = document.getElementById('evidenceLog');
    if(!el) return;
    const zid = extras.primaryZone;
    const ticks = window.SENTINEL_DATA.getHistoricalTicks();
    const rows = ticks.map((tick) => {
      const z = tick.zones[zid] || { gas: 0, temp: 0, score: 0 };
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
    el.innerHTML = rows;
  }

  // ---------- 4. Historical Similarity (closing section) ----------
  function renderSimilarity(extras) {
    const el = document.getElementById('historicalSimilarity');
    if(!el) return;
    const s = extras.historicalSimilarity;
    el.innerHTML = `
      <div class="report-similarity__value">${s.percent}</div>
      <div class="report-similarity__label">Current pattern match: ${s.profile}.</div>
      <div class="report-similarity__window">${s.window}</div>
    `;
    
    if (extras.geminiAnalysis) {
        const aiDiv = document.createElement('div');
        aiDiv.style.marginTop = '40px';
        aiDiv.style.padding = '20px';
        aiDiv.style.background = 'rgba(255,255,255,0.02)';
        aiDiv.style.border = '1px solid rgba(255,255,255,0.1)';
        aiDiv.style.borderRadius = '8px';
        aiDiv.innerHTML = `
            <h3 style="font-size:16px; margin-bottom:12px; color:var(--text-primary)">Sentinel Core Analysis (Gemini)</h3>
            <div style="font-size:14px; color:var(--text-secondary); white-space:pre-wrap; line-height:1.6">${extras.geminiAnalysis}</div>
        `;
        el.parentElement.appendChild(aiDiv);
    }
  }

  // ---------- Download PDF ----------
  function wireDownload() {
    const btn = document.getElementById('downloadPdfBtn');
    if (btn) btn.addEventListener('click', () => window.print());
  }

  // ---------- Init ----------
  async function init() {
    const generateBtn = document.createElement('button');
    generateBtn.textContent = 'Generate Live Report';
    generateBtn.className = 'btn';
    generateBtn.style.marginBottom = '20px';
    
    const container = document.querySelector('.report-container');
    if(container) container.insertBefore(generateBtn, container.firstChild);
    
    generateBtn.addEventListener('click', async () => {
        generateBtn.textContent = 'Generating via Sentinel Core...';
        generateBtn.disabled = true;
        try {
            const extras = await getReportExtras();
            renderHeader(extras);
            renderSummary(extras);
            renderActions(extras);
            renderTimeline();
            renderCompoundFactors(extras);
            renderViolations(extras);
            renderEvidenceLog(extras);
            renderSimilarity(extras);
            wireDownload();
            generateBtn.style.display = 'none';
        } catch(e) {
            console.error(e);
            generateBtn.textContent = 'Error generating report. Check console.';
        }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();