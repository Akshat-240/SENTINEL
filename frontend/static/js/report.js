/* ==========================================================================
   SENTINEL — report.js
   ========================================================================== */

(function () {
  'use strict';

  const generateBtn = document.getElementById('generateBtn');
  const zoneSelect = document.getElementById('zoneSelect');
  const reportOutput = document.getElementById('reportOutput');

  async function handleGenerate() {
    const zoneId = zoneSelect.value;
    if (!zoneId) return;

    generateBtn.disabled = true;
    zoneSelect.disabled = true;
    reportOutput.style.color = 'var(--text)';
    
    reportOutput.innerHTML = `<div class="loading-overlay" style="display:flex; flex-direction:column; gap:16px; justify-content:center; align-items:center; height:100%;">
        <div class="spinner"></div>
        <div>Generating report...</div>
    </div>`;

    try {
      const res = await fetch(`http://localhost:5000/api/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId })
      });
      
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      
      if (data.error) {
          reportOutput.innerHTML = `<span style="color:var(--risk-critical)">Error: ${data.error}</span>`;
      } else {
          let reportText = data.gemini_analysis || data.report || '';
          if (!reportText && typeof data === 'string') reportText = data;
          else if (!reportText) reportText = JSON.stringify(data, null, 2);

          if (reportText.includes("not configured")) {
              reportOutput.innerHTML = `<span style="color:var(--risk-warning); font-weight:bold;">⚠️ Gemini API key not set. <br>Set GEMINI_API_KEY environment variable.</span>`;
              return;
          }

          const zoneStr = data.zone_id || zoneId;
          const scoreStr = data.score || data.risk_score_final || 'N/A';
          const timeStr = data.timestamp || new Date().toISOString();

          let formattedText = reportText
              .replace(/^## (.*$)/gim, '<div style="font-size:1.2em; font-weight:bold; margin-top:16px; margin-bottom:8px; color:var(--text);">$1</div>')
              .replace(/\*\*(.*?)\*\*/g, '<span style="font-weight:bold; color:var(--text);">$1</span>');

          const headerHtml = `
            <div style="font-size:16px; font-weight:bold; margin-bottom:16px; padding:12px; background:var(--bg-sunken); border:1px solid var(--border); color:var(--text);">
              ZONE: ${zoneStr}  |  SCORE: ${scoreStr}  |  ${timeStr}
            </div>
          `;

          const btnHtml = `
            <button id="downloadBtn" style="margin-top:16px; padding:12px 24px; font-weight:bold; font-family:var(--font-mono); color:var(--text); background:var(--border-strong); border:none; cursor:pointer;">
              ⬇️ DOWNLOAD REPORT
            </button>
          `;

          reportOutput.innerHTML = `
            ${headerHtml}
            <div style="padding:16px; background:var(--bg-sunken); border:1px solid var(--border); font-family:var(--font-mono); font-size:13px; color:var(--text-muted); white-space:pre-wrap; line-height:1.6;">${formattedText}</div>
            ${btnHtml}
          `;

          document.getElementById('downloadBtn').addEventListener('click', () => {
              const blob = new Blob([reportText], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const dateStr = new Date().toISOString().split('T')[0];
              a.download = `SENTINEL_Report_${zoneStr}_${dateStr}.txt`;
              a.click();
              URL.revokeObjectURL(url);
          });
      }
    } catch (err) {
      reportOutput.innerHTML = `<span style="color:var(--risk-critical)">Error: ${err.message}</span>`;
    } finally {
      generateBtn.disabled = false;
      zoneSelect.disabled = false;
    }
  }

  if (generateBtn) {
      generateBtn.addEventListener('click', handleGenerate);
  }

  document.addEventListener('sentinel:config-loaded', (e) => {
      if (zoneSelect && e.detail && e.detail.configData) {
          zoneSelect.innerHTML = '';
          e.detail.configData.forEach(zone => {
              const shortId = zone.zone_id.toUpperCase().replace('ZONE_', '');
              const option = document.createElement('option');
              option.value = zone.zone_id;
              option.textContent = `ZONE ${shortId} (${zone.name})`;
              zoneSelect.appendChild(option);
          });
      }
  });
})();