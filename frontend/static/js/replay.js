/* ==========================================================================
   SENTINEL — replay.js
   Incident Replay page. Default view = Key Events (concise, matches the
   "room goes silent" demo narrative from System Design Module 10).
   Play Full Incident = every stored tick, auto-scrolling, pausing on the
   final SHUTDOWN entry. Reads shared tick data from data.js.
   Each entry can also freeze the whole app at that moment via
   SentinelReplay.enter() + a link into heatmap.html (global Replay Mode).
   ========================================================================== */

(function () {
  'use strict';

  const D = window.SENTINEL_DATA;
  const { TICKS, ZONE_AREA_NAME, LEVEL_LABEL, LEVEL_VAR, LEVEL_TINT_VAR, LEVEL_ORDER } = D;

  let activeZoneFilter = 'all';
  let searchQuery = '';
  let viewingFull = false; // false = Key Events, true = Full Incident (via Play)
  let isPlaying = false;
  let playTimer = null;
  let playIndex = 0;

  // ---------- Helpers ----------

  // Which zone an event line is "about", so zone filtering + the zone tag
  // has something to show. Falls back to the tick's worst-risk zone.
  function primaryZoneFor(tick) {
    if (tick.event) {
      const match = tick.event.match(/Zone\s([A-D])/);
      if (match) return match[1];
    }
    return worstZoneId(tick);
  }

  function worstZoneId(tick) {
    let best = null;
    Object.entries(tick.zones).forEach(([zid, z]) => {
      if (!best || LEVEL_ORDER.indexOf(z.level) > LEVEL_ORDER.indexOf(tick.zones[best].level)) {
        best = zid;
      }
    });
    return best;
  }

  function isKeyEventTick(tick) {
    return tick.event !== null;
  }

  function tickMatchesZone(tick, zoneFilter) {
    if (zoneFilter === 'all') return true;
    return primaryZoneFor(tick) === zoneFilter;
  }

  function tickMatchesSearch(tick, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const text = (tick.event || '').toLowerCase();
    return text.includes(q);
  }

  // Groups ticks that share an exact timestamp into a cluster, sorted by
  // that tick's worst zone score descending within the cluster. With the
  // current mock data no two ticks share a timestamp, but this keeps the
  // rendering correct the moment simultaneous events are added.
  function clusterByTimestamp(ticks) {
    const groups = {};
    ticks.forEach((t) => {
      if (!groups[t.time]) groups[t.time] = [];
      groups[t.time].push(t);
    });
    return Object.keys(groups).map((time) => {
      const group = groups[time];
      group.sort((a, b) => {
        const scoreA = a.zones[worstZoneId(a)].score;
        const scoreB = b.zones[worstZoneId(b)].score;
        return scoreB - scoreA;
      });
      return { time, ticks: group };
    });
  }

  // ---------- Rendering ----------

  function getFilteredTicks() {
    const source = viewingFull ? TICKS : TICKS.filter(isKeyEventTick);
    return source.filter((t) => tickMatchesZone(t, activeZoneFilter) && tickMatchesSearch(t, searchQuery));
  }

  function factorsHtmlFor(zoneId, z) {
    return `
      <div class="factor-row"><span>Gas</span><span>${z.gas} PPM</span></div>
      <div class="factor-row"><span>Temperature</span><span>${z.temp}°C</span></div>
      <div class="factor-row"><span>Permits</span><span>${z.permits}</span></div>
    `;
  }

  function entryDetailHtml(tick) {
    const zoneBlocks = Object.entries(tick.zones).map(([zid, z]) => `
      <div class="replay-entry__zone-block">
        <div class="replay-entry__zone-block-title">Zone ${zid} · ${ZONE_AREA_NAME[zid]} — ${LEVEL_LABEL[z.level]} · ${z.score}</div>
        ${factorsHtmlFor(zid, z)}
      </div>
    `).join('');

    return `
      ${zoneBlocks}
      <a class="replay-entry__view-heatmap" href="#" data-time="${tick.time}">View this moment in Heatmap →</a>
    `;
  }

  function renderTimeline() {
    const container = document.getElementById('replayTimeline');
    const filtered = getFilteredTicks();

    document.getElementById('replaySubtitle').textContent =
      `${viewingFull ? 'Full incident' : 'Key events'} · ${activeZoneFilter === 'all' ? 'All zones' : `Zone ${activeZoneFilter}`}`;

    if (!filtered.length) {
      container.innerHTML = `<div class="replay-empty">No timeline entries match this filter.</div>`;
      return;
    }

    const clusters = clusterByTimestamp(filtered);

    container.innerHTML = clusters.map((cluster) => {
      const entriesHtml = cluster.ticks.map((tick) => {
        const zid = primaryZoneFor(tick);
        const z = tick.zones[zid];
        const accent = `var(${LEVEL_VAR[z.level]})`;
        const text = tick.event || `Zone ${zid} — ${LEVEL_LABEL[z.level]}, score ${z.score}`;

        return `
          <div class="replay-entry" data-time="${tick.time}" style="--entry-color:${accent}">
            <div class="replay-entry__dot"></div>
            <div class="replay-entry__card">
              <div class="replay-entry__top">
                <span>
                  <span class="replay-entry__time">${tick.time}</span>
                  <span class="replay-entry__zone-tag">Zone ${zid}</span>
                </span>
                <span class="replay-entry__score">${LEVEL_LABEL[z.level]} · ${z.score}</span>
              </div>
              <div class="replay-entry__text">${text}</div>
              <div class="replay-entry__detail">${entryDetailHtml(tick)}</div>
            </div>
          </div>
        `;
      }).join('');

      // Only show a shared cluster heading when more than one entry shares a timestamp.
      const heading = cluster.ticks.length > 1
        ? `<div class="replay-cluster-heading">${cluster.time} — ${cluster.ticks.length} zones</div>`
        : '';

      return heading + entriesHtml;
    }).join('');

    window.SentinelExpand.attach('#replayTimeline', '.replay-entry');
    wireViewInHeatmapLinks();
  }

  function wireViewInHeatmapLinks() {
    document.querySelectorAll('.replay-entry__view-heatmap').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const time = link.dataset.time;
        if (window.SentinelReplay) window.SentinelReplay.enter(time);
        window.location.href = 'heatmap.html';
      });
    });
  }

  // ---------- Zone tabs + search ----------

  function wireControls() {
    document.querySelectorAll('.replay-zone-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.replay-zone-tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        activeZoneFilter = tab.dataset.zone;
        renderTimeline();
      });
    });

    document.getElementById('replaySearch').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderTimeline();
    });
  }

  // ---------- Play Full Incident ----------

  function togglePlay() {
    if (isPlaying) { stopPlay(); return; }
    startPlay();
  }

  function startPlay() {
    isPlaying = true;
    viewingFull = true;
    playIndex = 0;
    document.getElementById('playFullBtn').textContent = '❚❚ Pause';
    document.getElementById('playFullBtn').classList.add('is-playing');
    renderTimeline();
    stepPlay();
  }

  function stepPlay() {
    highlightCurrent(playIndex);
    const atEnd = playIndex >= TICKS.length - 1;
    const isShutdown = TICKS[playIndex].zones[worstZoneId(TICKS[playIndex])].level === 'shutdown';

    const delay = isShutdown ? 3000 : 1400; // deliberate pause on the SHUTDOWN entry
    playTimer = setTimeout(() => {
      if (atEnd) { stopPlay(); return; }
      playIndex += 1;
      stepPlay();
    }, delay);
  }

  function highlightCurrent(index) {
    const tick = TICKS[index];
    document.querySelectorAll('.replay-entry').forEach((el) => el.classList.remove('is-current'));
    const el = document.querySelector(`.replay-entry[data-time="${tick.time}"]`);
    if (el) {
      el.classList.add('is-current');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function stopPlay() {
    isPlaying = false;
    if (playTimer) clearTimeout(playTimer);
    playTimer = null;
    document.getElementById('playFullBtn').textContent = '▶ Play Full Incident';
    document.getElementById('playFullBtn').classList.remove('is-playing');
  }

  function wirePlayButton() {
    document.getElementById('playFullBtn').addEventListener('click', togglePlay);
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderTimeline();
    wireControls();
    wirePlayButton();
  });

  // React if Replay Mode is toggled globally while this page is open.
  document.addEventListener('sentinel:replay-changed', () => {
    // Nothing to resync here today — this page's own timeline isn't
    // itself governed by global Replay Mode, only its "View in Heatmap"
    // links write to it. Left as a hook for future pages that do need it.
  });
})();