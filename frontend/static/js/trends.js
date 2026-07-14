/* ==========================================================================
   SENTINEL — trends.js
   Gas Trend panel: line chart + Trend Predictor keypoints
   (Current / Trend / In 15 min / Critical in). Gas-only per Module 4.
   ========================================================================== */

(function () {
  'use strict';

  const GAS_SERIES = {
    A: [18, 19, 19, 20, 21, 22],
    B: [12, 14, 16, 18, 19, 20],
    C: [130, 138, 145, 165, 172, 176],
    D: [10, 11, 12, 12, 13, 12],
    E: [8, 9, 9, 10, 10, 11],
    F: [6, 7, 7, 8, 8, 9],
  };

  const CRITICAL_PPM = 500;

  let activeZone = 'B';

  function bandColor(v) {
    if (v > 500) return 'var(--risk-high)';
    if (v >= 200) return 'var(--risk-warning)';
    return 'var(--risk-normal)';
  }

  function slope(data) {
    // Simple linear regression slope over the last N points (per-tick units)
    const n = data.length;
    const xs = data.map((_, i) => i);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = data.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (data[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    return den === 0 ? 0 : num / den;
  }

  function trendDirection(data) {
    const m = slope(data);
    if (Math.abs(m) < 0.5) return 'STABLE';
    return m > 0 ? 'RISING' : 'FALLING';
  }

  function project15Min(data) {
    const m = slope(data);
    const current = data[data.length - 1];
    // Assume each tick = 2 minutes, so 15 min ≈ 7.5 ticks ahead
    return Math.round(current + m * 7.5);
  }

  function timeToCritical(data) {
    const m = slope(data);
    const current = data[data.length - 1];
    if (m <= 0) return null; // not rising, no ETA
    const ticksToCritical = (CRITICAL_PPM - current) / m;
    if (ticksToCritical <= 0) return 0;
    return Math.round(ticksToCritical * 2); // minutes, assuming 2 min/tick
  }

  function render() {
    const chart = document.getElementById('trendChart');
    if (!chart) return;
    drawLine(activeZone);
    renderKeypoints(activeZone);
    wireZoneButtons();
  }

  // Scoped to #gasZoneButtons so Temperature Trend's buttons (same CSS
  // class, different panel) are never picked up here.
  function wireZoneButtons() {
    document.querySelectorAll('#gasZoneButtons .temp-panel__zone-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#gasZoneButtons .temp-panel__zone-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeZone = btn.dataset.zone;
        drawLine(activeZone);
        renderKeypoints(activeZone);
      });
    });
  }

  function drawLine(zoneId) {
    const container = document.getElementById('trendChart');
    const data = GAS_SERIES[zoneId];

    const w = container.clientWidth || 600;
    const h = 160;
    const padLeft = 34;
    const padBottom = 20;
    const plotW = w - padLeft;
    const plotH = h - padBottom;

    const dataMax = Math.max(...data);
    const dataMin = Math.min(...data);
    const scaleMin = Math.max(0, Math.floor(dataMin / 10) * 10 - 10);
    const scaleMax = Math.ceil((dataMax + 20) / 10) * 10;

    const gridLines = [];
    const step = Math.max(10, Math.round((scaleMax - scaleMin) / 5 / 10) * 10);
    for (let v = scaleMin; v <= scaleMax; v += step) gridLines.push(v);

    const stepX = plotW / (data.length - 1);

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

    const points = data.map((v, i) => {
      const x = padLeft + i * stepX;
      const y = yFor(v);
      return { x, y, v };
    });

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${plotH} L ${points[0].x} ${plotH} Z`;

    const dotsHtml = points
      .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--risk-high)" class="gas-point" data-value="${p.v}" style="cursor:pointer"></circle>`)
      .join('');

    container.innerHTML = `
      <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="overflow:visible">
        ${gridHtml}
        <line x1="${padLeft}" y1="${plotH}" x2="${w}" y2="${plotH}" stroke="var(--border-strong)" stroke-width="1"></line>
        <path d="${areaD}" fill="var(--risk-high)" opacity="0.12"></path>
        <path d="${pathD}" fill="none" stroke="var(--risk-high)" stroke-width="2"></path>
        ${dotsHtml}
      </svg>
      <div class="trend-panel__tooltip" id="gasTrendTooltip"></div>
    `;

    const tooltip = document.getElementById('gasTrendTooltip');
    container.querySelectorAll('.gas-point').forEach((dot) => {
      dot.addEventListener('mouseenter', () => {
        const containerRect = container.getBoundingClientRect();
        const dotRect = dot.getBoundingClientRect();
        const x = dotRect.left - containerRect.left + dotRect.width / 2;
        const y = dotRect.top - containerRect.top;
        tooltip.textContent = `${dot.dataset.value} PPM`;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.style.opacity = '1';
      });
      dot.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    });
  }

  function renderKeypoints(zoneId) {
    const data = GAS_SERIES[zoneId];
    const current = data[data.length - 1];
    const direction = trendDirection(data);
    const predicted = project15Min(data);
    const eta = timeToCritical(data);

    const trendColor = direction === 'RISING' ? 'var(--risk-high)'
      : direction === 'FALLING' ? 'var(--risk-normal)'
      : 'var(--text-muted)';

    const el = document.getElementById('trendKeypoints');
    el.innerHTML = `
      <div>
        <div class="keypoint__label">Current</div>
        <div class="keypoint__value" style="--kp-color:${bandColor(current)}">${current} PPM</div>
      </div>
      <div>
        <div class="keypoint__label">Trend</div>
        <div class="keypoint__value is-trend" style="--kp-color:${trendColor}">${direction}</div>
      </div>
      <div>
        <div class="keypoint__label">In 15 min</div>
        <div class="keypoint__value" style="--kp-color:${bandColor(predicted)}">${predicted} PPM (predicted)</div>
      </div>
      <div>
        <div class="keypoint__label">Critical in</div>
        <div class="keypoint__value" style="--kp-color:var(--risk-high)">${eta === null ? '—' : `~${eta} min`}</div>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', render);
})();