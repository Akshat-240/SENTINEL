/* ==========================================================================
   SENTINEL — temps.js
   Temperature Trend panel: bar chart with real axis (y-scale + x-axis time
   labels, baseline), tighter bar spacing. Colors map to Module 2's actual
   temperature score bands: <40°C normal · 40–60°C warning · >60°C high.
   No "time to critical" here — the Trend Predictor module is gas-only.
   ========================================================================== */

(function () {
  'use strict';

  const TEMP_SERIES = {
    A: [30, 31, 31, 32, 32,56,78,45,34,30,20,30,31,31,32,32,56,78,45,34,30,20],
    B: [46, 50, 53, 56, 58,67,45,52,78,89,23,65,46,50,53,56,58,67,45,52,78,89],
    C: [36, 38, 39, 40, 41,20,30,42,22,20,27,47,36,38,39,40,41,20,30,42,22,20],
    D: [28, 28, 29, 29, 29,30,34,37,38,39,28,28,29,29,29,30,34,37,38,39,45,49],
  };

  const TIME_LABELS = ['0m', '2m', '4m', '6m', '8m', '10m', '12m', '14m', '16m', '18m', '20m', '22m', '24m', '26m', '28m', '30m', '32m', '34m', '36m', '38m', '40m', '42m'];

  let activeZone = 'A';

  function bandColor(v) {
    if (v > 60) return 'var(--risk-high)';
    if (v >= 40) return 'var(--risk-warning)';
    return 'var(--risk-normal)';
  }

  function trendDirection(data) {
    const delta = data[data.length - 1] - data[0];
    if (Math.abs(delta) < 1) return 'STABLE';
    return delta > 0 ? 'RISING' : 'FALLING';
  }

  function render() {
    const chart = document.getElementById('tempTrendChart');
    if (!chart) return;
    drawBars(activeZone);
    renderKeypoints(activeZone);
    wireZoneButtons();
  }

  // Scoped to #tempZoneButtons so Gas Trend's buttons (same CSS class,
  // different panel) are never picked up here.
  function wireZoneButtons() {
    document.querySelectorAll('#tempZoneButtons .temp-panel__zone-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tempZoneButtons .temp-panel__zone-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeZone = btn.dataset.zone;
        drawBars(activeZone);
        renderKeypoints(activeZone);
      });
    });
  }

  function drawBars(zoneId) {
    const container = document.getElementById('tempTrendChart');
    const data = TEMP_SERIES[zoneId];

    const w = container.clientWidth || 600;
    const h = 160;
    const padLeft = 34;   // room for y-axis labels
    const padBottom = 20; // room for x-axis time labels
    const plotW = w - padLeft;
    const plotH = h - padBottom;

    // Dynamic scale: fits the data range per zone (with headroom), so no
    // bar can ever exceed the plot area regardless of how hot a zone runs.
    const dataMax = Math.max(...data);
    const dataMin = Math.min(...data);
    const scaleMin = Math.max(0, Math.floor(dataMin / 10) * 10 - 10);
    const scaleMax = Math.ceil((dataMax + 5) / 10) * 10;

    const gridLines = [];
    for (let v = scaleMin; v <= scaleMax; v += 10) gridLines.push(v);

    const stepX = plotW / data.length;
    const barWidth = Math.min(28, stepX * 0.4); // capped so bars stay slim even on wide screens

    function yFor(v) {
      return plotH - ((v - scaleMin) / (scaleMax - scaleMin)) * plotH;
    }

    const gridHtml = gridLines
      .map((v) => {
        const y = yFor(v);
        return `
          <line x1="${padLeft}" y1="${y}" x2="${w}" y2="${y}" stroke="var(--border)" stroke-width="1"></line>
          <text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)" font-family="var(--font-mono)">${v}</text>
        `;
      })
      .join('');

    const barsHtml = data
      .map((v, i) => {
        const x = padLeft + i * stepX + (stepX - barWidth) / 2;
        const y = yFor(v);
        const barH = plotH - y;
        const labelX = x + barWidth / 2;
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4"
                fill="${bandColor(v)}" class="temp-bar" data-value="${v}" style="cursor:pointer"></rect>
          <text x="${labelX}" y="${plotH + 14}" text-anchor="middle" font-size="10" fill="var(--text-muted)" font-family="var(--font-mono)">${TIME_LABELS[i]}</text>
        `;
      })
      .join('');

    container.innerHTML = `
      <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="overflow:visible">
        ${gridHtml}
        <line x1="${padLeft}" y1="${plotH}" x2="${w}" y2="${plotH}" stroke="var(--border-strong)" stroke-width="1"></line>
        ${barsHtml}
      </svg>
      <div class="trend-panel__tooltip" id="tempTrendTooltip"></div>
    `;

    const tooltip = document.getElementById('tempTrendTooltip');
    container.querySelectorAll('.temp-bar').forEach((bar) => {
      bar.addEventListener('mouseenter', () => {
        const containerRect = container.getBoundingClientRect();
        const barRect = bar.getBoundingClientRect();
        const x = barRect.left - containerRect.left + barRect.width / 2;
        const y = barRect.top - containerRect.top;
        tooltip.textContent = `${bar.dataset.value}°C`;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.style.opacity = '1';
      });
      bar.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    });
  }

  function renderKeypoints(zoneId) {
    const data = TEMP_SERIES[zoneId];
    const current = data[data.length - 1];
    const direction = trendDirection(data);
    const trendColor = direction === 'RISING' ? 'var(--risk-high)'
      : direction === 'FALLING' ? 'var(--risk-normal)'
      : 'var(--text-muted)';

    const el = document.getElementById('tempTrendKeypoints');
    el.innerHTML = `
      <div>
        <div class="keypoint__label">Current</div>
        <div class="keypoint__value" style="--kp-color:${bandColor(current)}">${current}°C</div>
      </div>
      <div>
        <div class="keypoint__label">Trend</div>
        <div class="keypoint__value is-trend" style="--kp-color:${trendColor}">${direction}</div>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', render);
})();