/* ==========================================================================
   SENTINEL — trends.js
   Interactive trend graph (SVG line + hover tooltip) + key stat-lines below.
   Placeholder data — Day 4-7 wires this to /api/trend (last 5 readings, NumPy projection).
   ========================================================================== */

(function () {
  'use strict';

  const ZONE_SERIES = {
    A: [18, 19, 20, 21, 20],
    B: [210, 310, 370, 460, 520],
    C: [140, 155, 170, 178, 180],
    D: [10, 11, 12, 12, 12],
  };

  let activeZone = 'B';

  function render() {
    const chart = document.getElementById('trendChart');
    if (!chart) return;
    drawChart(activeZone);
    renderKeypoints(activeZone);
    wireZoneButtons();
  }

  function wireZoneButtons() {
    document.querySelectorAll('.trend-panel__zone-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.trend-panel__zone-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeZone = btn.dataset.zone;
        drawChart(activeZone);
        renderKeypoints(activeZone);
      });
    });
  }

  function drawChart(zoneId) {
    const container = document.getElementById('trendChart');
    const data = ZONE_SERIES[zoneId];
    const w = container.clientWidth || 600;
    const h = 160;
    const max = Math.max(...data) * 1.15;
    const min = Math.min(...data) * 0.85;
    const stepX = w / (data.length - 1);

    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / (max - min)) * h;
      return [x, y];
    });

    const linePath = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
    const areaPath = `${linePath} L${points[points.length - 1][0]},${h} L0,${h} Z`;

    const trendColor = trendDirection(data) === 'RISING' ? 'var(--risk-high)'
      : trendDirection(data) === 'FALLING' ? 'var(--risk-normal)'
      : 'var(--text-muted)';

    container.innerHTML = `
      <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="overflow:visible">
        <path d="${areaPath}" fill="${trendColor}" opacity="0.08"></path>
        <path d="${linePath}" fill="none" stroke="${trendColor}" stroke-width="2"></path>
        ${points
          .map(
            (p, i) =>
              `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${trendColor}" class="trend-dot" data-value="${data[i]}" style="cursor:pointer"></circle>`
          )
          .join('')}
      </svg>
      <div class="trend-panel__tooltip" id="trendTooltip"></div>
    `;

    const tooltip = document.getElementById('trendTooltip');
    container.querySelectorAll('.trend-dot').forEach((dot) => {
      dot.addEventListener('mouseenter', (e) => {
        const rect = container.getBoundingClientRect();
        const cx = parseFloat(dot.getAttribute('cx'));
        const cy = parseFloat(dot.getAttribute('cy'));
        tooltip.textContent = `${dot.dataset.value} PPM`;
        tooltip.style.left = `${cx}px`;
        tooltip.style.top = `${cy}px`;
        tooltip.style.opacity = '1';
      });
      dot.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    });
  }

  function trendDirection(data) {
    const delta = data[data.length - 1] - data[0];
    if (Math.abs(delta) < data[0] * 0.05) return 'STABLE';
    return delta > 0 ? 'RISING' : 'FALLING';
  }

  function renderKeypoints(zoneId) {
    const data = ZONE_SERIES[zoneId];
    const current = data[data.length - 1];
    const direction = trendDirection(data);
    const slope = (data[data.length - 1] - data[0]) / (data.length - 1);
    const projected = Math.round(current + slope * 30); // rough 15-min-equivalent projection for placeholder
    const critical = 500;
    const stepsToCritical = slope > 0 ? Math.max(0, Math.ceil((critical - current) / slope)) : null;

    const trendColor = direction === 'RISING' ? 'var(--risk-high)'
      : direction === 'FALLING' ? 'var(--risk-normal)'
      : 'var(--text-muted)';
    const criticalColor = stepsToCritical !== null && stepsToCritical <= 10 ? 'var(--risk-high)' : 'var(--text)';

    const el = document.getElementById('trendKeypoints');
    el.innerHTML = `
      <div>
        <div class="keypoint__label">Current</div>
        <div class="keypoint__value" style="--kp-color:${trendColor}">${current} PPM</div>
      </div>
      <div>
        <div class="keypoint__label">Trend</div>
        <div class="keypoint__value is-trend" style="--kp-color:${trendColor}">${direction}</div>
      </div>
      <div>
        <div class="keypoint__label">In 15 min</div>
        <div class="keypoint__value">${projected} PPM (predicted)</div>
      </div>
      <div>
        <div class="keypoint__label">Critical in</div>
        <div class="keypoint__value" style="--kp-color:${criticalColor}">${stepsToCritical !== null ? `~${stepsToCritical * 2} min` : '—'}</div>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', render);
})();