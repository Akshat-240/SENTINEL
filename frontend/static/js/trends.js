/* ==========================================================================
   SENTINEL — trends.js
   Gas Trend panel: line chart + Trend Predictor keypoints
   ========================================================================== */

(function () {
  'use strict';

  const CRITICAL_PPM = 500;
  let activeZone = 'B';

  function getGasSeries(zoneId) {
    const ticks = window.SENTINEL_DATA.getHistoricalTicks();
    return ticks.map(t => (t.zones[zoneId] && t.zones[zoneId].gas) ? t.zones[zoneId].gas : 0);
  }

  function getTimeLabels() {
    const ticks = window.SENTINEL_DATA.getHistoricalTicks();
    return ticks.map(t => {
       if (t.time === 'Now' || t.time === '00:00:00') return t.time;
       const parts = t.time.split(':');
       return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t.time;
    });
  }

  function bandColor(v) {
    if (v > 500) return 'var(--risk-high)';
    if (v >= 200) return 'var(--risk-warning)';
    return 'var(--risk-normal)';
  }

  function slope(data) {
    const n = data.length;
    if (n < 2) return 0;
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
    return Math.round(current + m * 7.5);
  }

  function timeToCritical(data) {
    const m = slope(data);
    const current = data[data.length - 1];
    if (m <= 0) return null;
    const ticksToCritical = (CRITICAL_PPM - current) / m;
    if (ticksToCritical <= 0) return 0;
    return Math.round(ticksToCritical * 2);
  }

  function render() {
    const chart = document.getElementById('trendChart');
    if (!chart) return;
    drawLine(activeZone);
    renderKeypoints(activeZone);
    wireZoneButtons();
  }

  function wireZoneButtons() {
    document.querySelectorAll('#gasZoneButtons .temp-panel__zone-btn').forEach((btn) => {
      btn.replaceWith(btn.cloneNode(true));
    });
    
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
    const data = getGasSeries(zoneId);
    if (!data.length) {
        container.innerHTML = `<div style="padding-left:34px; padding-top:50px; color:var(--text-muted);">Waiting for data...</div>`;
        return;
    }

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

    const stepX = data.length > 1 ? plotW / (data.length - 1) : plotW;

    function yFor(v) {
      if (scaleMax === scaleMin) return plotH / 2;
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
    const data = getGasSeries(zoneId);
    if (!data.length) return;
    const current = data[data.length - 1];
    const direction = trendDirection(data);
    const predicted = project15Min(data);
    const eta = timeToCritical(data);

    const trendColor = direction === 'RISING' ? 'var(--risk-high)'
      : direction === 'FALLING' ? 'var(--risk-normal)'
      : 'var(--text-muted)';

    const el = document.getElementById('trendKeypoints');
    if (!el) return;
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

  document.addEventListener('DOMContentLoaded', () => {
      render();
      document.addEventListener('sentinel:data-updated', (e) => {
          if (e.detail.type === 'historical') {
              drawLine(activeZone);
              renderKeypoints(activeZone);
          }
      });
  });
})();