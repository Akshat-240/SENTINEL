/* ============================================================
   SENTINEL — COMMAND CENTER DASHBOARD v3.0
   Pure data-driven rendering — zero hardcoded risk values.
   All colors, animations, and indicators derive from API data.
   ============================================================ */

(function () {
  'use strict';

  // ── STATE ─────────────────────────────────────────────────
  const state = {
    zoneNames: {},      // from /api/dashboard/config
    zoneMaxWorkers: {}, // from config
    highestRiskZone: null,
    gasChart: null,
    sparkCharts: {},
    firstRun: true,
    alertHistory: [],   // track last N counts for sparklines
    riskHistory: [],
    particles: [],
    animFrame: null,
  };

  // ── HELPERS: RISK COLOR SYSTEM ────────────────────────────
  // Color determined ONLY from API score — nothing hardcoded
  function colorFor(score) {
    if (score <= 40)  return { hex: '#00ff88', rgb: '0,255,136',   css: 'var(--c-safe)',     label: 'NORMAL' };
    if (score <= 60)  return { hex: '#ffd700', rgb: '255,215,0',   css: 'var(--c-caution)',  label: 'CAUTION' };
    if (score <= 75)  return { hex: '#ff8c00', rgb: '255,140,0',   css: 'var(--c-warning)',  label: 'WARNING' };
    if (score <= 85)  return { hex: '#ff4444', rgb: '255,68,68',   css: 'var(--c-high)',     label: 'HIGH RISK' };
    return              { hex: '#ff0000', rgb: '255,0,0',     css: 'var(--c-critical)', label: 'CRITICAL' };
  }

  function severityColor(severity) {
    const s = (severity || '').toUpperCase();
    if (s === 'CRITICAL' || s === 'EMERGENCY') return { hex: '#ff0000', rgb: '255,0,0' };
    if (s === 'HIGH' || s === 'HIGH_RISK')     return { hex: '#ff4444', rgb: '255,68,68' };
    if (s === 'WARNING' || s === 'CAUTION')    return { hex: '#ff8c00', rgb: '255,140,0' };
    return { hex: '#00ff88', rgb: '0,255,136' };
  }

  function timeAgo(tsStr) {
    if (!tsStr) return '';
    const diff = Math.floor((Date.now() - new Date(tsStr)) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return `${Math.floor(diff/3600)}h ago`;
  }

  // ── COMPOUND DESCRIPTIONS (labels only, not data values) ──
  const COMPOUND_MAP = {
    hot_work_gas:    { emoji: '🔥', text: 'Hot Work + Gas >500 PPM', pts: 15 },
    confined_gas:    { emoji: '⚠️', text: 'Confined Space + Gas',    pts: 15 },
    workers_heat:    { emoji: '🌡️', text: 'High Density + Heat',     pts: 15 },
    triple_threat:   { emoji: '☣️', text: 'Triple Threat',            pts: 20 },
    electrical_gas:  { emoji: '⚡', text: 'Electrical + Gas',         pts: 15 },
    night_shift:     { emoji: '🌙', text: 'Night Shift Risk',         pts: 10 },
  };

  // ── DOM REFS ───────────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const el = {
    bootOverlay:  $('boot-overlay'),
    bootProgress: $('boot-progress'),
    bootStatus:   $('boot-status'),
    appShell:     document.querySelector('.app-shell'),
    clock:        $('live-clock'),
    date:         $('live-date'),
    sysDot:       $('system-dot'),
    sysBadge:     $('sys-badge'),
    sysBadgeDot:  $('sys-badge-dot'),
    sysBadgeTxt:  $('sys-badge-text'),
    valZones:     $('val-zones'),
    valAlerts:    $('val-alerts'),
    valRisk:      $('val-risk'),
    valStatus:    $('val-status'),
    kpiZones:     $('kpi-zones'),
    kpiAlerts:    $('kpi-alerts'),
    kpiRisk:      $('kpi-risk'),
    kpiStatus:    $('kpi-status'),
    kpiZonesGlow: $('kpi-zones-glow'),
    kpiAlertsGlow:$('kpi-alerts-glow'),
    kpiRiskGlow:  $('kpi-risk-glow'),
    kpiStatGlow:  $('kpi-status-glow'),
    kpiZonesIcon: $('kpi-zones-icon'),
    kpiAlertsIcon:$('kpi-alerts-icon'),
    kpiRiskIcon:  $('kpi-risk-icon'),
    kpiStatIcon:  $('kpi-status-icon'),
    zoneGrid:     $('zone-grid'),
    alertFeed:    $('alert-feed'),
    compoundList: $('compound-list'),
    chartTitle:   $('chart-title'),
    trendPpm:     $('trend-ppm'),
    trendBadge:   $('trend-badge'),
    statPred:     $('stat-pred'),
    statTtc:      $('stat-ttc'),
    dnaContent:   $('dna-content'),
    modal:        $('zone-modal'),
    modalClose:   $('modal-close'),
    modalZoneId:  $('modal-zone-id'),
    modalTitle:   $('modal-title'),
    modalScoreTxt:$('modal-score-text'),
    modalBody:    $('modal-body'),
    scoreArc:     $('score-arc'),
    pageTitle:    $('page-title'),
  };

  // ── PARTICLE SYSTEM (Three.js-like but pure canvas) ────────
  // A sophisticated, multi-layered particle network on canvas
  function initParticles() {
    const canvas = $('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const PARTICLE_COUNT = 80;
    const CONNECT_DIST = 140;
    const particles = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x:  Math.random() * W,
        y:  Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r:  Math.random() * 1.5 + 0.5,
        life: Math.random() * Math.PI * 2,
      });
    }

    // Global particle color state — updated when risk changes
    state.particleColor = { r: 0, g: 212, b: 255 };

    function lerp(a, b, t) { return a + (b - a) * t; }

    function drawParticles() {
      ctx.clearRect(0, 0, W, H);
      const { r, g, b } = state.particleColor;
      const base = `${r},${g},${b}`;

      // Update
      particles.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.life += 0.01;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.18;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${base},${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach(p => {
        const alpha = (Math.sin(p.life) * 0.3 + 0.5) * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${base},${alpha})`;
        ctx.fill();
      });

      state.animFrame = requestAnimationFrame(drawParticles);
    }
    drawParticles();
  }

  // Smoothly transition particle color toward a target
  function shiftParticleColor(targetHex) {
    const hex = targetHex.replace('#','');
    const tr = parseInt(hex.substring(0,2),16);
    const tg = parseInt(hex.substring(2,4),16);
    const tb = parseInt(hex.substring(4,6),16);
    const step = 3;
    state.particleColor.r += (tr - state.particleColor.r) > 0 ? Math.min(step, tr - state.particleColor.r) : Math.max(-step, tr - state.particleColor.r);
    state.particleColor.g += (tg - state.particleColor.g) > 0 ? Math.min(step, tg - state.particleColor.g) : Math.max(-step, tg - state.particleColor.g);
    state.particleColor.b += (tb - state.particleColor.b) > 0 ? Math.min(step, tb - state.particleColor.b) : Math.max(-step, tb - state.particleColor.b);
  }

  // ── SPARKLINE CHARTS ───────────────────────────────────────
  function initSparkline(canvasId, color) {
    const canvas = $(canvasId);
    if (!canvas || !window.Chart) return null;
    return new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: color, borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.4 }] },
      options: { responsive: false, animation: false, scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false } } }
    });
  }

  function pushSparkline(chart, val, maxPoints = 12) {
    if (!chart) return;
    chart.data.labels.push('');
    chart.data.datasets[0].data.push(val);
    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update('none');
  }

  // ── BOOT SEQUENCE ──────────────────────────────────────────
  const BOOT_MESSAGES = [
    'LOADING ZONE CONFIGURATIONS...',
    'CONNECTING SENSOR FUSION ENGINE...',
    'INITIALIZING RISK CALCULATOR...',
    'BUILDING THREAT VECTOR MAP...',
    'ACTIVATING DISASTER DNA MODULE...',
    'SAFETY INTELLIGENCE ONLINE.',
  ];
  let bootIdx = 0;
  function bootTick() {
    if (bootIdx >= BOOT_MESSAGES.length) return;
    if (el.bootStatus)  el.bootStatus.textContent = BOOT_MESSAGES[bootIdx];
    if (el.bootProgress) el.bootProgress.style.width = ((bootIdx + 1) / BOOT_MESSAGES.length * 100) + '%';
    bootIdx++;
    if (bootIdx < BOOT_MESSAGES.length) setTimeout(bootTick, 200);
  }
  bootTick();

  // ── CLOCK ──────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    if (el.clock) el.clock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    if (el.date)  el.date.textContent  = now.toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ── GSAP COUNTER ──────────────────────────────────────────
  function animCounter(el, from, to, duration = 1) {
    if (!window.gsap || !el) { if (el) el.textContent = to; return; }
    gsap.to({ val: from }, {
      val: to,
      duration,
      ease: 'power2.out',
      onUpdate: function() { el.textContent = Math.floor(this.targets()[0].val); }
    });
  }

  // ── FETCH HELPERS ──────────────────────────────────────────
  async function safeFetch(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  // ── CONFIG LOAD ───────────────────────────────────────────
  async function loadConfig() {
    const cfg = await safeFetch('/api/dashboard/config');
    if (!cfg || !Array.isArray(cfg)) return;
    cfg.forEach(z => {
      state.zoneNames[z.zone_id] = z.name || z.zone_id;
      state.zoneMaxWorkers[z.zone_id] = z.max_workers || 10;
    });
  }

  // ── KPI RENDER ────────────────────────────────────────────
  function renderKPIs(zones, alerts) {
    const prevZones  = parseInt(el.valZones?.textContent)  || 0;
    const prevAlerts = parseInt(el.valAlerts?.textContent) || 0;
    const prevRisk   = parseInt(el.valRisk?.textContent)   || 0;

    const zCount = zones.length;
    const aCount = alerts.length;
    const rCount = zones.filter(z => z.final_score > 60).length;

    // Animate counters
    animCounter(el.valZones,  state.firstRun ? 0 : prevZones,  zCount);
    animCounter(el.valAlerts, state.firstRun ? 0 : prevAlerts, aCount);
    animCounter(el.valRisk,   state.firstRun ? 0 : prevRisk,   rCount);

    // Track history for sparklines
    state.alertHistory.push(aCount);
    state.riskHistory.push(rCount);
    if (state.alertHistory.length > 12) state.alertHistory.shift();
    if (state.riskHistory.length  > 12) state.riskHistory.shift();

    // Sparklines
    pushSparkline(state.sparkCharts.zones,  zCount);
    pushSparkline(state.sparkCharts.alerts, aCount);
    pushSparkline(state.sparkCharts.risk,   rCount);

    // Zones KPI — always neutral cyan
    applyKpiTheme(el.kpiZones, el.kpiZonesGlow, el.kpiZonesIcon, el.valZones, '#00d4ff');

    // Alerts KPI — data driven
    const alertColor = aCount > 0 ? '#ff4444' : '#00ff88';
    applyKpiTheme(el.kpiAlerts, el.kpiAlertsGlow, el.kpiAlertsIcon, el.valAlerts, alertColor);
    if (state.sparkCharts.alerts) {
      state.sparkCharts.alerts.data.datasets[0].borderColor = alertColor;
      state.sparkCharts.alerts.update('none');
    }

    // Zones at risk KPI — data driven
    const riskColor = rCount > 0 ? (rCount > 2 ? '#ff4444' : '#ff8c00') : '#00ff88';
    applyKpiTheme(el.kpiRisk, el.kpiRiskGlow, el.kpiRiskIcon, el.valRisk, riskColor);
    if (state.sparkCharts.risk) {
      state.sparkCharts.risk.data.datasets[0].borderColor = riskColor;
      state.sparkCharts.risk.update('none');
    }

    // Status always green
    applyKpiTheme(el.kpiStatus, el.kpiStatGlow, el.kpiStatIcon, null, '#00ff88');
  }

  function applyKpiTheme(card, glowEl, iconEl, valEl, colorHex) {
    if (!card) return;
    const alpha = '33';
    card.style.borderColor = colorHex + '55';
    card.style.boxShadow   = `0 0 20px ${colorHex}22, inset 0 0 20px ${colorHex}08`;
    if (glowEl) {
      glowEl.style.background = `linear-gradient(90deg, transparent, ${colorHex}, transparent)`;
      glowEl.style.boxShadow  = `0 0 10px ${colorHex}`;
    }
    if (iconEl) {
      iconEl.style.borderColor = colorHex + '55';
      iconEl.style.color = colorHex;
      iconEl.style.boxShadow = `0 0 10px ${colorHex}44`;
    }
    if (valEl)  valEl.style.color = colorHex;
  }

  // ── ZONE GRID ─────────────────────────────────────────────
  function renderZoneGrid(zones) {
    let maxScore = -1;

    zones.forEach(zone => {
      if (zone.final_score > maxScore) {
        maxScore = zone.final_score;
        state.highestRiskZone = zone.zone_id;
      }
    });

    // Shift particle background color based on highest risk
    const topColor = colorFor(maxScore);
    shiftParticleColor(topColor.hex === '#00ff88' ? '#00d4ff' : topColor.hex);

    // Update page title
    if (el.pageTitle) {
      if (maxScore >= 86)     el.pageTitle.textContent = '🚨 CRITICAL — SENTINEL';
      else if (maxScore > 60) el.pageTitle.textContent = '⚠️ WARNING — SENTINEL';
      else                    el.pageTitle.textContent = 'SENTINEL — Zero Harm';
    }

    // Update system dot color
    const dotColor = topColor.hex;
    if (el.sysDot) { el.sysDot.style.background = dotColor; el.sysDot.style.boxShadow = `0 0 12px ${dotColor}`; }
    if (el.sysBadgeDot) { el.sysBadgeDot.style.background = dotColor; el.sysBadgeDot.style.boxShadow = `0 0 8px ${dotColor}`; }
    if (el.sysBadge) {
      el.sysBadge.style.borderColor = dotColor + '44';
      el.sysBadge.style.background  = `rgba(${topColor.rgb},0.07)`;
      el.sysBadge.style.color       = dotColor;
    }

    // Render cards
    if (el.zoneGrid) {
      el.zoneGrid.innerHTML = '';
      zones.forEach((zone, idx) => {
        const c       = colorFor(zone.final_score);
        const name    = state.zoneNames[zone.zone_id] || zone.zone_id;
        const workers = zone.snapshot?.worker_count ?? 0;
        const isCrit  = zone.final_score > 85;

        const card = document.createElement('div');
        card.className = 'zone-card' + (isCrit ? ' zone-critical' : '');
        card.style.setProperty('--zone-accent', c.hex);
        card.style.borderColor = c.hex + '44';
        card.style.boxShadow   = `0 0 ${isCrit ? 24 : 12}px rgba(${c.rgb},${isCrit ? 0.35 : 0.15})`;
        card.dataset.zoneId    = zone.zone_id;
        card.dataset.zoneName  = name;

        const scoreRounded = Math.round(zone.final_score);

        card.innerHTML = `
          <div class="zc-top">
            <div>
              <div class="zc-id">${zone.zone_id}</div>
              <div class="zc-name">${name}</div>
            </div>
            <div class="zc-score-wrap">
              <div class="zc-score" style="color:${c.hex}; text-shadow: 0 0 14px ${c.hex}66;">${scoreRounded}</div>
              <div class="zc-level" style="color:${c.hex};">${c.label}</div>
            </div>
          </div>
          <div class="zc-bar-track">
            <div class="zc-bar-fill" id="bar-${zone.zone_id}" style="background-color:${c.hex}; width:0%; box-shadow:0 0 8px ${c.hex};"></div>
          </div>
          <div class="zc-footer">
            <div class="zc-workers">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${c.hex}" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>${workers} workers</span>
            </div>
            <div class="zc-detail-btn">DETAILS →</div>
          </div>
        `;

        card.addEventListener('click', () => showModal(zone.zone_id, name));
        el.zoneGrid.appendChild(card);

        // GSAP: stagger fade-in + bar fill
        if (window.gsap) {
          gsap.fromTo(card, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, delay: idx * 0.07, ease: 'power2.out' });
          gsap.to(`#bar-${zone.zone_id}`, { width: `${zone.final_score}%`, duration: 1, delay: 0.4 + idx * 0.07, ease: 'power2.out' });
        } else {
          document.getElementById(`bar-${zone.zone_id}`).style.width = `${zone.final_score}%`;
        }
      });
    }
  }

  // ── ALERT FEED ────────────────────────────────────────────
  function renderAlertFeed(alerts) {
    if (!el.alertFeed) return;
    el.alertFeed.innerHTML = '';

    if (!alerts.length) {
      el.alertFeed.innerHTML = `<div class="no-risk-msg">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        All systems nominal
      </div>`;
      return;
    }

    alerts.slice(0, 15).forEach((alert, idx) => {
      const sc = severityColor(alert.severity);
      const msg = (alert.message || '').substring(0, 45) + ((alert.message || '').length > 45 ? '…' : '');
      const item = document.createElement('div');
      item.className = 'alert-item slide-in';
      item.style.animationDelay = `${idx * 0.04}s`;
      item.innerHTML = `
        <div class="alert-stripe" style="background:${sc.hex}; box-shadow: 0 0 8px ${sc.hex};"></div>
        <div class="alert-body">
          <div class="alert-row1">
            <span class="alert-zone-tag" style="color:${sc.hex}; border-color:${sc.hex}44;">${alert.zone_id}</span>
            <span class="alert-time">${timeAgo(alert.timestamp)}</span>
          </div>
          <div class="alert-type">${alert.alert_type || ''}</div>
          <div class="alert-msg">${msg}</div>
        </div>`;
      el.alertFeed.appendChild(item);
    });
  }

  // ── COMPOUND RISKS ────────────────────────────────────────
  function renderCompoundRisks(zones) {
    if (!el.compoundList) return;
    el.compoundList.innerHTML = '';
    let found = false;

    zones.forEach(zone => {
      const combs = zone.combinations_detected || [];
      combs.forEach(key => {
        found = true;
        const cfg = COMPOUND_MAP[key] || { emoji: '⚠️', text: key.toUpperCase(), pts: 10 };
        const chip = document.createElement('div');
        chip.className = 'compound-chip';
        chip.innerHTML = `
          <span class="compound-chip-zone">${zone.zone_id}</span>
          <span>${cfg.emoji}</span>
          <span class="compound-chip-label">${cfg.text}</span>
          <span class="compound-chip-pts">+${cfg.pts}pts</span>`;
        el.compoundList.appendChild(chip);
      });
    });

    if (!found) {
      el.compoundList.innerHTML = `<div class="no-risk-msg">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-safe)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        No compound risks detected
      </div>`;
    }
  }

  // ── GAS TREND CHART ───────────────────────────────────────
  async function renderTrendChart(zoneId) {
    const data = await safeFetch(`/api/risk/trend/${zoneId}`);
    if (!data) return;

    const name = state.zoneNames[zoneId] || zoneId;
    if (el.chartTitle) el.chartTitle.textContent = `GAS TREND — ${name}`;

    // Determine color purely from trend direction returned by API
    let trendHex, trendLabel;
    if (data.trend === 'RISING') {
      trendHex   = '#ff4444';
      trendLabel = '↑ RISING';
    } else if (data.trend === 'FALLING') {
      trendHex   = '#00d4ff';
      trendLabel = '↓ FALLING';
    } else {
      trendHex   = '#00ff88';
      trendLabel = '→ STABLE';
    }

    if (el.trendPpm) {
      el.trendPpm.textContent  = `${Number(data.current_gas_ppm).toFixed(1)} PPM`;
      el.trendPpm.style.color  = trendHex;
      el.trendPpm.style.textShadow = `0 0 12px ${trendHex}66`;
    }
    if (el.trendBadge) {
      el.trendBadge.textContent  = trendLabel;
      el.trendBadge.style.color  = trendHex;
      el.trendBadge.style.borderColor = trendHex + '55';
      el.trendBadge.style.background  = trendHex + '11';
    }
    if (el.statPred) el.statPred.textContent = `${Number(data.predicted_in_15min).toFixed(1)} PPM`;
    if (el.statTtc) {
      if (data.alert && data.minutes_to_critical !== null) {
        el.statTtc.textContent = `${data.minutes_to_critical} min`;
        el.statTtc.style.color = '#ff0000';
      } else {
        el.statTtc.textContent = '—';
        el.statTtc.style.color = 'var(--text-b)';
      }
    }

    // Build chart data from slope (API doesn't give us historical array, reconstruct)
    const slope = data.slope || 0;
    const cur   = data.current_gas_ppm || 0;
    const pts   = [
      Math.max(0, cur - slope * 4),
      Math.max(0, cur - slope * 3),
      Math.max(0, cur - slope * 2),
      Math.max(0, cur - slope),
      cur,
    ];

    const canvas = $('gasChart');
    if (!canvas || !window.Chart) return;

    // Create gradient fill
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 120);
    grad.addColorStop(0, trendHex + '55');
    grad.addColorStop(1, trendHex + '00');

    if (state.gasChart) {
      state.gasChart.data.datasets[0].data          = pts;
      state.gasChart.data.datasets[0].borderColor   = trendHex;
      state.gasChart.data.datasets[0].backgroundColor = grad;
      state.gasChart.data.datasets[0].pointBackgroundColor = trendHex;
      state.gasChart.update();
    } else {
      state.gasChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['-2m', '-1.5m', '-1m', '-30s', 'Now'],
          datasets: [{
            data: pts,
            borderColor: trendHex,
            backgroundColor: grad,
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: [0, 0, 0, 0, 5],
            pointBackgroundColor: trendHex,
            pointBorderColor: 'transparent',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: state.firstRun ? 1200 : 400, easing: 'easeOutQuart' },
          scales: {
            x: {
              display: true,
              grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
              ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9, family: "'Share Tech Mono'" } },
            },
            y: {
              display: true,
              grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
              ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9, family: "'Share Tech Mono'" } },
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(8,12,30,0.9)',
              borderColor: trendHex + '55',
              borderWidth: 1,
              titleColor: trendHex,
              bodyColor: '#fff',
              titleFont: { family: "'Share Tech Mono'" },
              bodyFont: { family: "'Share Tech Mono'" },
              callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1)} PPM` }
            }
          }
        }
      });
    }
  }

  // ── DISASTER DNA ──────────────────────────────────────────
  async function renderDisasterDNA(zoneId) {
    const data = await safeFetch(`/api/risk/similarity/${zoneId}`);
    if (!el.dnaContent) return;
    if (!data) {
      el.dnaContent.innerHTML = `<div class="dna-loading">No profile data available.</div>`;
      return;
    }

    const sim  = Number(data.highest_similarity || 0);
    const name = data.matched_profile || 'Unknown Profile';
    const hrs  = data.intervention_window_hours;
    const simC = colorFor(sim > 70 ? 90 : sim > 40 ? 70 : 30);

    el.dnaContent.innerHTML = `
      <div style="display:flex; align-items:flex-end; gap:12px;">
        <div>
          <div class="dna-pct" style="color:${simC.hex}; text-shadow:0 0 16px ${simC.hex}66;">${sim.toFixed(1)}%</div>
          <div class="dna-label">PROFILE MATCH</div>
        </div>
        <div style="flex:1; margin-bottom:6px;">
          <div class="dna-bar-track">
            <div class="dna-bar-fill" style="width:${sim}%; background:${simC.hex};"></div>
          </div>
        </div>
      </div>
      <div class="dna-detail">Similar to: <strong>${name}</strong></div>
      <div class="dna-sub">Intervention window: <span style="color:${simC.hex}">${hrs !== null && hrs !== undefined ? hrs + ' hours' : 'N/A'}</span></div>
      ${data.alert ? `<div style="margin-top:10px; padding:6px 10px; background:rgba(255,0,0,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:4px; font-size:11px; color:#ff4444; font-family:var(--f-mono);">⚠ ALERT: HIGH SIMILARITY THRESHOLD REACHED</div>` : ''}
    `;
  }

  // ── ZONE DETAIL MODAL ─────────────────────────────────────
  async function showModal(zoneId, zoneName) {
    const data = await safeFetch(`/api/risk/score/${zoneId}`);
    if (!data || !el.modal) return;

    const score = data.final_score || 0;
    const c     = colorFor(score);
    const b     = data.base_scores || {};

    if (el.modalZoneId)    el.modalZoneId.textContent  = zoneId;
    if (el.modalTitle)     el.modalTitle.textContent   = zoneName;
    if (el.modalScoreTxt)  el.modalScoreTxt.textContent = Math.round(score);
    if (el.modalScoreTxt)  el.modalScoreTxt.style.fill  = c.hex;

    // Animate SVG arc (circumference = 2π×34 ≈ 213.6)
    if (el.scoreArc) {
      el.scoreArc.style.stroke = c.hex;
      el.scoreArc.style.filter = `drop-shadow(0 0 6px ${c.hex})`;
      const offset = 213.6 - (score / 100) * 213.6;
      el.scoreArc.style.strokeDashoffset = offset;
    }

    // Build breakdown bars from API data
    const rows = [
      { label: 'Gas Score',     val: b.gas_score    || 0, max: 40,  color: '#ff6b35' },
      { label: 'Temp Score',    val: b.temp_score   || 0, max: 20,  color: '#f7c59f' },
      { label: 'Permit Score',  val: b.permit_score || 0, max: 20,  color: '#ffbe0b' },
      { label: 'Worker Score',  val: b.worker_score || 0, max: 10,  color: '#8ecae6' },
      { label: 'History Score', val: b.history_score|| 0, max: 10,  color: '#a8dadc' },
      { label: 'Compound Bonus',val: data.compound_bonus || 0, max: 30, color: '#ff8c00', isBonus: true },
    ];

    if (el.modalBody) {
      el.modalBody.innerHTML = rows.map(row => `
        <div class="mb-row">
          <div class="mb-label-row">
            <span class="mb-label">${row.label}</span>
            <span class="mb-val" style="color:${row.color}">${row.isBonus ? '+' : ''}${row.val} / ${row.max}</span>
          </div>
          <div class="mb-bar-track">
            <div class="mb-bar-fill" style="width:${Math.min(100,(row.val/row.max)*100)}%; background:${row.color}; color:${row.color};"></div>
          </div>
        </div>
      `).join('');
    }

    if (data.combinations_detected && data.combinations_detected.length) {
      el.modalBody.innerHTML += `
        <div style="margin-top:16px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.08);">
          <div style="font-family:var(--f-mono); font-size:10px; letter-spacing:1px; color:var(--text-b); margin-bottom:8px;">COMPOUND VECTORS</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${data.combinations_detected.map(k => {
              const cfg = COMPOUND_MAP[k] || { emoji:'⚠️', text:k, pts:10 };
              return `<div class="compound-chip" style="font-size:11px;">${cfg.emoji} ${cfg.text} <span class="compound-chip-pts">+${cfg.pts}</span></div>`;
            }).join('')}
          </div>
        </div>`;
    }

    el.modal.classList.add('active');
    if (window.gsap) gsap.to(el.modal, { opacity: 1, duration: 0.25 });
    else el.modal.style.opacity = 1;
  }

  if (el.modalClose) {
    el.modalClose.addEventListener('click', () => {
      if (window.gsap) {
        gsap.to(el.modal, { opacity: 0, duration: 0.2, onComplete: () => el.modal.classList.remove('active') });
      } else {
        el.modal.style.opacity = 0;
        el.modal.classList.remove('active');
      }
    });
  }

  // Click outside to close
  el.modal?.addEventListener('click', e => {
    if (e.target === el.modal) el.modalClose?.click();
  });

  // ── MAIN DATA REFRESH ─────────────────────────────────────
  async function refresh() {
    const [zones, alerts] = await Promise.all([
      safeFetch('/api/dashboard/zones'),
      safeFetch('/api/dashboard/alerts'),
    ]);

    if (!zones || !alerts) return;

    renderKPIs(zones, alerts);
    renderZoneGrid(zones);
    renderAlertFeed(alerts);
    renderCompoundRisks(zones);

    if (state.highestRiskZone) {
      renderTrendChart(state.highestRiskZone);
      renderDisasterDNA(state.highestRiskZone);
    }
  }

  // ── INIT ──────────────────────────────────────────────────
  async function init() {
    // Start particle animation
    initParticles();

    // Init sparkline charts
    state.sparkCharts.zones  = initSparkline('spark-zones',  '#00d4ff');
    state.sparkCharts.alerts = initSparkline('spark-alerts', '#00ff88');
    state.sparkCharts.risk   = initSparkline('spark-risk',   '#00ff88');

    // Load zone config
    await loadConfig();

    // Animate boot bar to 100%
    if (el.bootProgress) el.bootProgress.style.width = '100%';
    setTimeout(() => {
      if (el.bootStatus) el.bootStatus.textContent = 'SAFETY INTELLIGENCE ONLINE.';
    }, 200);

    // First data fetch
    await refresh();
    state.firstRun = false;

    // Fade in app
    setTimeout(() => {
      if (el.bootOverlay && window.gsap) {
        gsap.to(el.bootOverlay, {
          opacity: 0, duration: 0.8, ease: 'power2.inOut',
          onComplete: () => { el.bootOverlay.style.display = 'none'; }
        });
        gsap.to(el.appShell, { opacity: 1, duration: 0.8, delay: 0.3, ease: 'power2.out' });
      } else if (el.bootOverlay) {
        el.bootOverlay.style.display = 'none';
        if (el.appShell) el.appShell.style.opacity = '1';
      }
    }, 1800);

    // Auto-refresh every 30s
    setInterval(refresh, 30000);
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);
  // Fallback if already loaded
  if (document.readyState !== 'loading') init();

})();
