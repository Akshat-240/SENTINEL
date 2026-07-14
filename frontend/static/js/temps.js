/* ==========================================================================
   SENTINEL — temps.js
   Temperature Trend panel: bar chart with real axis (y-scale + x-axis time
   labels, baseline), tighter bar spacing.
   ========================================================================== */

(function () {
  'use strict';

  let activeZone = 'A';

  function getTempSeries(zoneId) {
    const ticks = window.SENTINEL_DATA.getHistoricalTicks();
    return ticks.map(t => (t.zones[zoneId] && t.zones[zoneId].temp) ? t.zones[zoneId].temp : 0);
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
    if (v > 60) return 'var(--risk-high)';
    if (v >= 40) return 'var(--risk-warning)';
    return 'var(--risk-normal)';
  }

  function trendDirection(data) {
    if (data.length < 2) return 'STABLE';
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

  function wireZoneButtons() {
    document.querySelectorAll('#tempZoneButtons .temp-panel__zone-btn').forEach((btn) => {
      // Avoid adding multiple listeners if render() is called again
      btn.replaceWith(btn.cloneNode(true));
    });
    
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
    const data = getTempSeries(zoneId);
    const labels = getTimeLabels();

    const w = container.clientWidth || 600;
    const h = 160;
    const padLeft = 34;   
    const padBottom = 20; 
    const plotW = w - padLeft;
    const plotH = h - padBottom;

    if (data.length === 0) {
        container.innerHTML = `<div style="padding-left:34px; padding-top:50px; color:var(--text-muted);">Waiting for data...</div>`;
        return;
    }

    const dataMax = Math.max(...data);
    const dataMin = Math.min(...data);
    const scaleMin = Math.max(0, Math.floor(dataMin / 10) * 10 - 10);
    const scaleMax = Math.ceil((dataMax + 5) / 10) * 10;

    const gridLines = [];
    for (let v = scaleMin; v <= scaleMax; v += 10) gridLines.push(v);

    const stepX = plotW / data.length;
    const barWidth = Math.min(28, stepX * 0.4);

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

    // Sample labels if too many (prevent crowding)
    const labelStep = Math.ceil(data.length / (plotW / 40));

    const barsHtml = data
      .map((v, i) => {
        const x = padLeft + i * stepX + (stepX - barWidth) / 2;
        const y = yFor(v);
        const barH = plotH - y;
        const labelX = x + barWidth / 2;
        const labelHtml = (i % labelStep === 0 || i === data.length - 1) ? 
           `<text x="${labelX}" y="${plotH + 14}" text-anchor="middle" font-size="10" fill="var(--text-muted)" font-family="var(--font-mono)">${labels[i]}</text>` : '';
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4"
                fill="${bandColor(v)}" class="temp-bar" data-value="${v}" style="cursor:pointer"></rect>
          ${labelHtml}
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
    const data = getTempSeries(zoneId);
    if (!data.length) return;
    const current = data[data.length - 1];
    const direction = trendDirection(data);
    const trendColor = direction === 'RISING' ? 'var(--risk-high)'
      : direction === 'FALLING' ? 'var(--risk-normal)'
      : 'var(--text-muted)';

    const el = document.getElementById('tempTrendKeypoints');
    if (!el) return;
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

  document.addEventListener('DOMContentLoaded', () => {
      render();
      document.addEventListener('sentinel:data-updated', (e) => {
          // Historical ticks drive the charts
          if (e.detail.type === 'historical') {
              drawBars(activeZone);
              renderKeypoints(activeZone);
          }
      });
  });
})();